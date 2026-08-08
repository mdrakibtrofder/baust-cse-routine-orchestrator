import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { Period } from '../../entities/period.entity';
import { Day } from '../../entities/day.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { CourseLabSection } from '../../entities/course-lab-section.entity';
import { Department } from '../../entities/department.entity';
import { TeacherUnavailability } from '../../entities/teacher-unavailability.entity';
import { RoomUnavailability } from '../../entities/room-unavailability.entity';
import { PriorityClass } from '../../entities/priority-class.entity';

/** Short name of the home/owning department (BAUST CSE) — mirrors the frontend
 *  constant in src/lib/constants.ts. Rooms without a department belong to it. */
const HOME_DEPT_SHORT_NAME = 'CSE';
/** Keep in sync with `THEORY_AUTO_GENERATION_MAX_PERIOD_NUMBER` in the frontend
 *  constants file. The backend generator cannot import that file directly
 *  because the frontend and orchestrator build separately. */
const THEORY_AUTO_GENERATION_MAX_PERIOD_NUMBER = 6;

export enum GeneratorStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface GeneratorProgress {
  status: GeneratorStatus;
  totalSlots: number;
  generatedSlots: number;
  failedSlots: number;
  /** Number of pre-existing locked class slots that were preserved across
   *  this regeneration. A value >0 means at least one slot was kept intact
   *  while everything else was rebuilt from scratch. */
  lockedSlotsPreserved: number;
  logs: string[];
  startTime?: Date;
  endTime?: Date;
  report?: {
    successRate: number;
    totalAttempted: number;
    successful: number;
    failed: number;
    resolved: number;
    conflictsEncountered: string[];
  };
}

/** One class meeting to place: either a regular section slot (section_id set)
 *  or a lab-section slot (lab_section_id set, section_id null, shared by every
 *  section in coveredSectionIds). */
interface PlacementTarget {
  courseId: string;
  courseCode: string;
  courseType: string;
  sectionId: string | null;
  labSectionId: string | null;
  coveredSectionIds: string[];
  totalStudents: number;
  deptType: 'Departmental' | 'Non-Departmental';
  teacherIds: string[];
  primaryRoomId: string | null;
  label: string;
}

interface PlacementUnit {
  target: PlacementTarget;
  slotsNeeded: number;
  /** Per-slot teacher override for split-teacher sessional_3.0 courses */
  slotTeacherIds?: string[][] | null;
}

interface FailedPlacement {
  target: PlacementTarget;
  assignedDays: string[];
}

interface SchedulingContext {
  semesterId: string;
  days: Day[];
  periods: Period[];
  rooms: Room[];
  teacherUnavail: TeacherUnavailability[];
  roomUnavail: RoomUnavailability[];
  /** `${course_id}:${section_id}` -> assignment, for resolving teachers of placed slots */
  cstByKey: Map<string, CourseSectionTeacher>;
  labSectionsById: Map<string, CourseLabSection>;
  sectionsById: Map<string, Section>;
  coursesById: Map<string, Course>;
  /** course_id -> number of lab sections defined for that course this semester */
  labCountByCourse: Map<string, number>;
  /** department_id -> short name (upper-cased), for the department room rule */
  deptShortById: Map<string, string>;
}

@Injectable()
export class RoutineGeneratorService {
  private readonly logger = new Logger(RoutineGeneratorService.name);
  private progress: GeneratorProgress = {
    status: GeneratorStatus.IDLE,
    totalSlots: 0,
    generatedSlots: 0,
    failedSlots: 0,
    lockedSlotsPreserved: 0,
    logs: [],
  };

  private stopFlag = false;
  private pauseFlag = false;
  private conflictsEncountered: string[] = [];

  constructor(
    @InjectRepository(ClassSlot)
    private readonly classSlotRepository: Repository<ClassSlot>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Period)
    private readonly periodRepository: Repository<Period>,
    @InjectRepository(Day)
    private readonly dayRepository: Repository<Day>,
    @InjectRepository(CourseSectionTeacher)
    private readonly cstRepository: Repository<CourseSectionTeacher>,
    @InjectRepository(CourseLabSection)
    private readonly labSectionRepository: Repository<CourseLabSection>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(TeacherUnavailability)
    private readonly teacherUnavailabilityRepository: Repository<TeacherUnavailability>,
    @InjectRepository(RoomUnavailability)
    private readonly roomUnavailabilityRepository: Repository<RoomUnavailability>,
    @InjectRepository(PriorityClass)
    private readonly priorityClassRepository: Repository<PriorityClass>,
  ) {}

  getProgress(): GeneratorProgress {
    return this.progress;
  }

  async start(semesterId: string, resolveConflicts = true) {
    if (this.progress.status === GeneratorStatus.RUNNING) {
      return;
    }

    this.resetState();
    this.progress.status = GeneratorStatus.RUNNING;
    this.progress.startTime = new Date();
    this.addLog('Starting routine generation...');

    // Run in background
    this.runGeneration(semesterId, resolveConflicts).catch((err) => {
      this.logger.error('Generation failed', err);
      this.progress.status = GeneratorStatus.FAILED;
      this.addLog(`CRITICAL ERROR: ${err.message}`);
    });
  }

  pause() {
    if (this.progress.status === GeneratorStatus.RUNNING) {
      this.pauseFlag = true;
      this.progress.status = GeneratorStatus.PAUSED;
      this.addLog('Generation paused.');
    }
  }

  resume() {
    if (this.progress.status === GeneratorStatus.PAUSED) {
      this.pauseFlag = false;
      this.progress.status = GeneratorStatus.RUNNING;
      this.addLog('Generation resumed.');
    }
  }

  stop() {
    this.stopFlag = true;
    this.progress.status = GeneratorStatus.STOPPED;
    this.addLog('Generation stopped by user.');
  }

  private resetState() {
    this.stopFlag = false;
    this.pauseFlag = false;
    this.conflictsEncountered = [];
    this.progress = {
      status: GeneratorStatus.IDLE,
      totalSlots: 0,
      generatedSlots: 0,
      failedSlots: 0,
      lockedSlotsPreserved: 0,
      logs: [],
    };
  }

  private addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.progress.logs.push(`[${timestamp}] ${message}`);
    if (this.progress.logs.length > 500) {
      this.progress.logs.shift();
    }
    this.logger.log(message);
  }

  private async waitWhilePaused() {
    while (this.pauseFlag && !this.stopFlag) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  private slotsNeededFor(courseType: string, credit: number): number {
    if (courseType.includes('sessional')) {
      return courseType === 'sessional_3.0' ? 2 : 1;
    }
    return Math.ceil(credit);
  }

  private eligiblePeriods(periods: Period[], requiredKind: 'theory' | 'sessional'): Period[] {
    const filtered = periods.filter(
      (p) => !p.is_break && !p.name.toLowerCase().includes('break') && p.kind === requiredKind,
    );
    if (requiredKind !== 'theory') return filtered;
    return [...filtered]
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, THEORY_AUTO_GENERATION_MAX_PERIOD_NUMBER);
  }

  private async runGeneration(semesterId: string, resolveConflicts: boolean) {
    const backupSlots = await this.classSlotRepository.find({ where: { semester_id: semesterId } });
    const lockedSlots = backupSlots.filter(s => s.locked);

    try {
      // 1. Clear non-locked slots for the semester.
      //    Locked slots are user-pinned entries and must be preserved across
      //    every regeneration. We only wipe the rows whose `locked` flag is
      //    explicitly false; if there are no locked slots we wipe everything.
      if (lockedSlots.length > 0) {
        this.addLog(`Preserving ${lockedSlots.length} locked class slot(s).`);
        const deleted = await this.classSlotRepository
          .createQueryBuilder()
          .delete()
          .where('semester_id = :semesterId', { semesterId })
          .andWhere('locked = :locked', { locked: false })
          .execute();
        this.addLog(`Removed ${deleted.affected ?? 0} non-locked class slot(s) before regeneration.`);
        this.progress.lockedSlotsPreserved = lockedSlots.length;
      } else {
        const deleted = await this.classSlotRepository
          .createQueryBuilder()
          .delete()
          .where('semester_id = :semesterId', { semesterId })
          .execute();
        this.addLog(`Cleared ${deleted.affected ?? 0} existing class slot(s) for this semester.`);
        this.progress.lockedSlotsPreserved = 0;
      }

      // 2. Fetch all required data
      const assignments = await this.cstRepository.find({
        where: { semester_id: semesterId },
        relations: ['course', 'section'],
      });
      const labSections = await this.labSectionRepository.find({
        where: { semester_id: semesterId },
        relations: ['course'],
      });

      const days = await this.dayRepository.find();
      const periods = await this.periodRepository.find({
        order: { start: 'ASC' }
      });
      const rooms = await this.roomRepository.find();
      const allSections = await this.sectionRepository.find();
      const departments = await this.departmentRepository.find();
      const teacherUnavail = await this.teacherUnavailabilityRepository.find();
      const roomUnavail = await this.roomUnavailabilityRepository.find();

      const labCountByCourse = new Map<string, number>();
      for (const l of labSections) {
        labCountByCourse.set(l.course_id, (labCountByCourse.get(l.course_id) ?? 0) + 1);
      }

      const ctx: SchedulingContext = {
        semesterId,
        days,
        periods,
        rooms,
        teacherUnavail,
        roomUnavail,
        cstByKey: new Map(assignments.map(a => [`${a.course_id}:${a.section_id}`, a])),
        labSectionsById: new Map(labSections.map(l => [l.id, l])),
        sectionsById: new Map(allSections.map(s => [s.id, s])),
        coursesById: new Map([
          ...assignments.map(a => [a.course_id, a.course] as const),
          ...labSections.map(l => [l.course_id, l.course] as const),
        ]),
        labCountByCourse,
        deptShortById: new Map(departments.map(d => [d.id, d.short_name.trim().toUpperCase()])),
      };

      // Sections covered by a lab section, per course: those course-section
      // assignments are scheduled through their lab sections instead
      const labCoveredSections = new Map<string, Set<string>>();
      for (const l of labSections) {
        const set = labCoveredSections.get(l.course_id) ?? new Set<string>();
        l.section_ids.forEach(id => set.add(id));
        labCoveredSections.set(l.course_id, set);
      }

      // Track locked slots by course-section/lab-section
      const lockedCountsByCourseSection = new Map<string, number>(); // key: courseId:sectionId
      const lockedCountsByLabSection = new Map<string, number>();     // key: labSectionId
      for (const slot of lockedSlots) {
        if (slot.lab_section_id) {
          const key = slot.lab_section_id;
          lockedCountsByLabSection.set(key, (lockedCountsByLabSection.get(key) ?? 0) + 1);
          this.addLog(`LOCKED: Preserving lab section slot: ${ctx.coursesById.get(slot.course_id)?.code} (Lab Sec ${ctx.labSectionsById.get(slot.lab_section_id)?.label}) on ${slot.day} ${slot.start}-${slot.end}`);
        } else if (slot.section_id) {
          const key = `${slot.course_id}:${slot.section_id}`;
          lockedCountsByCourseSection.set(key, (lockedCountsByCourseSection.get(key) ?? 0) + 1);
          const course = ctx.coursesById.get(slot.course_id);
          const section = ctx.sectionsById.get(slot.section_id);
          this.addLog(`LOCKED: Preserving slot: ${course?.code} (L${section?.level} T${section?.term} Sec ${section?.name}) on ${slot.day} ${slot.start}-${slot.end}`);
        }
      }

      // 3. Build placement units
      const units: PlacementUnit[] = [];

      for (const l of labSections) {
        if (!l.course.course_type.includes('sessional')) {
          this.addLog(`SKIPPING lab section ${l.course.code}-${l.label}: course is not sessional.`);
          continue;
        }
        const mappedSections = l.section_ids
          .map(id => ctx.sectionsById.get(id))
          .filter((s): s is Section => !!s);
        const slotsNeeded = this.slotsNeededFor(l.course.course_type, l.course.credit);
        const lockedSlotsForThisLab = lockedCountsByLabSection.get(l.id) ?? 0;
        const slotsToGenerate = slotsNeeded - lockedSlotsForThisLab;
        
        if (slotsToGenerate > 0) {
          units.push({
            target: {
              courseId: l.course_id,
              courseCode: l.course.code,
              courseType: l.course.course_type,
              sectionId: null,
              labSectionId: l.id,
              coveredSectionIds: l.section_ids,
              totalStudents: this.labSectionStudents(l.course, ctx),
              deptType: mappedSections[0]?.departmental_type ?? 'Departmental',
              teacherIds: l.teacher_ids ?? [],
              primaryRoomId: l.primary_room_id,
              label: `${l.course.code} (Lab Sec ${l.label})`,
            },
            slotsNeeded: slotsToGenerate,
          });
        } else if (slotsToGenerate === 0) {
          this.addLog(`SKIPPING lab section ${l.course.code}-${l.label}: All ${slotsNeeded} slot(s) are locked.`);
        }
      }

      for (const a of assignments) {
        const isSessional = a.course.course_type.includes('sessional');
        if (isSessional && labCoveredSections.get(a.course_id)?.has(a.section_id)) {
          continue; // scheduled via its lab sections
        }
        const isSplit = a.course.course_type === 'sessional_3.0' &&
          Array.isArray(a.slot_teacher_ids) &&
          a.slot_teacher_ids.length > 0;
        const key = `${a.course_id}:${a.section_id}`;
        const slotsNeeded = this.slotsNeededFor(a.course.course_type, a.course.credit);
        const lockedSlotsForThisSection = lockedCountsByCourseSection.get(key) ?? 0;
        const slotsToGenerate = slotsNeeded - lockedSlotsForThisSection;

        if (slotsToGenerate > 0) {
          units.push({
            target: {
              courseId: a.course_id,
              courseCode: a.course.code,
              courseType: a.course.course_type,
              sectionId: a.section_id,
              labSectionId: null,
              coveredSectionIds: [a.section_id],
              totalStudents: a.section.total_students,
              deptType: a.section.departmental_type,
              teacherIds: a.teacher_ids ?? [],
              primaryRoomId: a.primary_room_id,
              label: `${a.course.code} (L${a.section.level} T${a.section.term} Sec ${a.section.name})`,
            },
            slotsNeeded: slotsToGenerate,
            slotTeacherIds: isSplit ? a.slot_teacher_ids : null,
          });
        } else if (slotsToGenerate === 0) {
          this.addLog(`SKIPPING ${a.course.code} (L${a.section.level} T${a.section.term} Sec ${a.section.name}): All ${slotsNeeded} slot(s) are locked.`);
        }
      }

      // 4. Sort: lab sections first, then other sessionals, then theory —
      // hardest-to-place go first
      // Fetch priority classes
      const priorityClasses = await this.priorityClassRepository.find({
        where: { semester_id: semesterId },
      });

      // Link priority classes to placement units
      const prioritizedUnits: { unit: PlacementUnit; priority?: PriorityClass }[] = units.map(unit => {
        const priority = priorityClasses.find(p => {
          const sectionMatch = p.section_id === unit.target.sectionId || 
            (unit.target.coveredSectionIds && unit.target.coveredSectionIds.includes(p.section_id));
          const courseMatch = !p.course_ids || p.course_ids.length === 0 || p.course_ids.includes(unit.target.courseId);
          return sectionMatch && courseMatch;
        });
        return { unit, priority };
      });

      // Sort prioritized units: priority ones first, then sessional, then theory
      prioritizedUnits.sort((a, b) => {
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;
        const rank = (u: PlacementUnit) =>
          u.target.labSectionId ? 0 : u.target.courseType.includes('sessional') ? 1 : 2;
        return rank(a.unit) - rank(b.unit);
      });

      const total = units.reduce((sum, u) => sum + u.slotsNeeded, 0);
      this.progress.totalSlots = total;

      // 5. Iterate and generate
      const failedPlacements: FailedPlacement[] = [];
      for (const { unit, priority } of prioritizedUnits) {
        if (this.stopFlag) break;

        const target = unit.target;
        const isSessional = target.courseType.includes('sessional');

        // Sessional requirement: at least one teacher assigned
        if (isSessional && target.teacherIds.length === 0) {
          this.addLog(`SKIPPING ${target.label}: Sessional course must have at least one teacher assigned.`);
          this.progress.failedSlots += unit.slotsNeeded;
          this.conflictsEncountered.push(`${target.label}: No teacher assigned`);
          continue;
        }

        const assignedDays: string[] = [];

        for (let i = 0; i < unit.slotsNeeded; i++) {
          await this.waitWhilePaused();
          if (this.stopFlag) break;

          // For split-teacher sessional_3.0, use per-slot teacher for conflict checking
          const slotTarget: PlacementTarget = {
            ...target,
            teacherIds: unit.slotTeacherIds?.[i] ?? target.teacherIds,
          };

          let success = false;
          if (priority) {
            this.addLog(`Priority Class matching found for ${target.label}. Attempting with priority constraints...`);
            success = await this.generateSlot(ctx, slotTarget, assignedDays, priority);
            if (!success) {
              this.addLog(`Failed to place ${target.label} under priority constraints. Falling back to standard generation...`);
            }
          }

          if (!success) {
            success = await this.generateSlot(ctx, slotTarget, assignedDays);
          }

          if (success) {
            this.progress.generatedSlots++;
            this.addLog(`Slot ${i + 1}/${unit.slotsNeeded} for ${target.label} assigned successfully.`);
          } else {
            this.progress.failedSlots++;
            this.addLog(`FAILED to assign slot ${i + 1}/${unit.slotsNeeded} for ${target.label}. No available combination found.`);
            this.conflictsEncountered.push(`${target.label}: No available time/room slot`);
            failedPlacements.push({ target: slotTarget, assignedDays });
          }
        }
      }

      // 6. Optional second pass: try to resolve room/time conflicts left by the first pass
      let resolvedCount = 0;
      if (!this.stopFlag && resolveConflicts && failedPlacements.length > 0) {
        resolvedCount = await this.runConflictResolution(ctx, failedPlacements);
      }

      if (this.stopFlag) {
        this.addLog('Rollback: Restoring previous slots due to user stop.');
        await this.classSlotRepository.delete({ semester_id: semesterId });
        await this.classSlotRepository.save(backupSlots);
        this.progress.status = GeneratorStatus.STOPPED;
      } else {
        this.progress.status = GeneratorStatus.COMPLETED;
        this.progress.endTime = new Date();

        const successRate = total > 0 ? (this.progress.generatedSlots / total) * 100 : 0;
        this.progress.report = {
          successRate,
          totalAttempted: total,
          successful: this.progress.generatedSlots,
          failed: this.progress.failedSlots,
          resolved: resolvedCount,
          conflictsEncountered: this.conflictsEncountered,
        };
        this.addLog(`Routine generation completed. Success rate: ${successRate.toFixed(2)}%`);
      }

    } catch (err) {
      this.addLog('Rollback: Restoring previous slots due to error.');
      // Wipe the partial state and restore the original snapshot. The
      // snapshot includes locked slots whose `locked: true` flag must be
      // preserved; TypeORM `save` will upsert by primary key and keep the
      // flag intact.
      await this.classSlotRepository
        .createQueryBuilder()
        .delete()
        .where('semester_id = :semesterId', { semesterId })
        .execute();
      if (backupSlots.length > 0) {
        await this.classSlotRepository.save(backupSlots);
      }

      this.progress.status = GeneratorStatus.FAILED;
      this.addLog(`Generation failed: ${err}`);
      throw err;
    }
  }

  private periodMatchesTimeSlots(period: Period, timeSlots: { start: string; end: string }[]): boolean {
    const toMin = (t: string) => {
      if (!t) return 0;
      const cleanTime = t.replace(/[AP]M/i, "").trim();
      const parts = cleanTime.includes(":") ? cleanTime.split(":") : cleanTime.split(".");
      const h = Number(parts[0] || 0);
      const m = Number(parts[1] || 0);
      return h * 60 + m;
    };
    const ps = toMin(period.start);
    const pe = toMin(period.end);
    return timeSlots.some(ts => toMin(ts.start) === ps && toMin(ts.end) === pe);
  }

  private async generateSlot(
    ctx: SchedulingContext,
    target: PlacementTarget,
    assignedDays: string[],
    priority?: PriorityClass,
  ): Promise<boolean> {
    const isSessional = target.courseType.includes('sessional');
    const requiredKind = isSessional ? 'sessional' : 'theory';
    const weekPatterns: ('EVERY' | 'EVEN' | 'ODD')[] = target.courseType === 'sessional_0.75' 
      ? ['EVEN', 'ODD', 'EVERY'] 
      : ['EVERY'];

    // Filter days based on priority if specified
    let baseDays = ctx.days;
    if (priority && priority.days && priority.days.length > 0) {
      baseDays = ctx.days.filter(d => priority.days.includes(d.name));
    }
    const shuffledDays = [...baseDays].sort(() => Math.random() - 0.5);

    // Filter periods based on priority if specified
    let basePeriods = this.eligiblePeriods(ctx.periods, requiredKind);
    if (priority && priority.time_slots && priority.time_slots.length > 0) {
      basePeriods = basePeriods.filter(p => this.periodMatchesTimeSlots(p, priority.time_slots));
    }
    const candidatePeriods = basePeriods.sort(() => Math.random() - 0.5);

    // Filter rooms based on priority if specified
    let allowedRooms = ctx.rooms;
    if (priority && priority.room_ids && priority.room_ids.length > 0) {
      allowedRooms = ctx.rooms.filter(r => priority.room_ids.includes(r.id));
    }

    for (const day of shuffledDays) {
      // Constraint: multiple classes of same course must be on different days
      if (assignedDays.includes(day.name)) continue;

      // For sessional_0.75, try to find other sections of same course and use opposite week
      let preferredWeek: 'EVEN' | 'ODD' | null = null;
      if (target.courseType === 'sessional_0.75') {
        const otherSectionSlots = await this.classSlotRepository.find({
          where: {
            semester_id: ctx.semesterId,
            course_id: target.courseId,
            day: day.name,
          },
        });
        for (const os of otherSectionSlots) {
          if (candidatePeriods.some((period) => this.timesOverlap(os.start, os.end, period.start, period.end))) {
            preferredWeek = os.week === 'EVEN' ? 'ODD' : 'EVEN';
            break;
          }
        }
      }

      const weeksToTry = preferredWeek ? [preferredWeek] : weekPatterns;

      for (const tryWeek of weeksToTry) {
        for (const period of candidatePeriods) {
          if (await this.hasSectionOrTeacherConflict(ctx, day.name, period, target.coveredSectionIds, target.teacherIds, tryWeek)) {
            continue;
          }

          // Preferred room first, then rooms matching type/capacity, preferring
          // rooms whose departmental type matches the section's
          const candidateRooms: Room[] = [];
          if (target.primaryRoomId) {
            const primaryRoom = allowedRooms.find(r => r.id === target.primaryRoomId);
            if (primaryRoom) candidateRooms.push(primaryRoom);
          }
          candidateRooms.push(...allowedRooms.filter(r =>
            r.id !== target.primaryRoomId &&
            this.roomFits(r, target.courseType, target.totalStudents) &&
            this.roomAllowedForCourse(r, target.courseCode, ctx)
          )
            .sort(() => Math.random() - 0.5)
            .sort((a, b) =>
              (a.departmental_type === target.deptType ? 0 : 1) -
              (b.departmental_type === target.deptType ? 0 : 1)
            ));

          for (const room of candidateRooms) {
            if (await this.hasRoomConflict(ctx, day.name, period, room, tryWeek)) continue;

            await this.saveSlot(ctx.semesterId, target, room, day.name, period, tryWeek);
            assignedDays.push(day.name);
            return true;
          }
        }
      }
    }

    return false;
  }

  /** Sections whose students are occupied by this slot (lab slots cover every mapped section) */
  private coveredSectionIdsOf(slot: ClassSlot, ctx: SchedulingContext): string[] {
    if (slot.lab_section_id) {
      return ctx.labSectionsById.get(slot.lab_section_id)?.section_ids ?? [];
    }
    return slot.section_id ? [slot.section_id] : [];
  }

  private teacherIdsOf(slot: ClassSlot, ctx: SchedulingContext): string[] {
    if (slot.lab_section_id) {
      return ctx.labSectionsById.get(slot.lab_section_id)?.teacher_ids ?? [];
    }
    if (!slot.section_id) return [];
    return ctx.cstByKey.get(`${slot.course_id}:${slot.section_id}`)?.teacher_ids ?? [];
  }

  private async hasRoomConflict(
    ctx: SchedulingContext,
    day: string,
    period: Pick<Period, 'start' | 'end'>,
    room: Room,
    week: 'EVERY' | 'EVEN' | 'ODD' = 'EVERY',
  ): Promise<boolean> {
    // Room conflict (already assigned, any overlapping time with overlapping week)
    const roomSlots = await this.classSlotRepository.find({
      where: { semester_id: ctx.semesterId, day, room_id: room.id },
    });
    if (roomSlots.some(s => 
      this.timesOverlap(s.start, s.end, period.start, period.end) && 
      this.weeksOverlap(s.week, week)
    )) {
      return true;
    }

    // Room unavailability
    const roomUn = ctx.roomUnavail.find(u =>
      u.room_id === room.id &&
      u.days.includes(day) &&
      this.timesOverlap(u.start, u.end, period.start, period.end)
    );
    return !!roomUn;
  }

  private async hasSectionOrTeacherConflict(
    ctx: SchedulingContext,
    day: string,
    period: Pick<Period, 'start' | 'end'>,
    sectionIds: string[],
    teacherIds: string[],
    week: 'EVERY' | 'EVEN' | 'ODD' = 'EVERY',
  ): Promise<boolean> {
    // Teacher unavailability
    for (const teacherId of teacherIds) {
      const tUn = ctx.teacherUnavail.find(u =>
        u.teacher_id === teacherId &&
        u.day === day &&
        this.timesOverlap(u.start, u.end, period.start, period.end)
      );
      if (tUn) return true;
    }

    // Section / teacher double-booking against every overlapping slot that day,
    // including lab-section slots (which occupy all their mapped sections),
    // checking week overlap
    const daySlots = await this.classSlotRepository.find({
      where: { semester_id: ctx.semesterId, day },
    });

    for (const slot of daySlots) {
      if (!this.timesOverlap(slot.start, slot.end, period.start, period.end)) continue;
      if (!this.weeksOverlap(slot.week, week)) continue;

      const slotSections = this.coveredSectionIdsOf(slot, ctx);
      if (slotSections.some(id => sectionIds.includes(id))) return true;

      const slotTeachers = this.teacherIdsOf(slot, ctx);
      if (slotTeachers.some(id => teacherIds.includes(id))) return true;
    }

    return false;
  }

  /** Students per lab section: the course's level-term cohort split evenly
   *  across all lab sections of the course. Since multiple departments can run
   *  the same level-term, the cohort is restricted to the department(s) of the
   *  sections the course's lab groups map (falling back to the course's own
   *  department when no sections are mapped yet). */
  private labSectionStudents(course: Course, ctx: SchedulingContext): number {
    const labCount = ctx.labCountByCourse.get(course.id) ?? 0;
    if (labCount === 0) return 0;

    const deptIds = new Set<string | null>();
    for (const l of ctx.labSectionsById.values()) {
      if (l.course_id !== course.id) continue;
      for (const sectionId of l.section_ids) {
        const s = ctx.sectionsById.get(sectionId);
        if (s) deptIds.add(s.department_id);
      }
    }
    if (deptIds.size === 0) deptIds.add(course.department_id);

    let cohortTotal = 0;
    for (const s of ctx.sectionsById.values()) {
      if (s.level === course.level && s.term === course.term && deptIds.has(s.department_id)) {
        cohortTotal += s.total_students;
      }
    }
    return Math.ceil(cohortTotal / labCount);
  }

  private roomFits(room: Room, courseType: string, totalStudents: number): boolean {
    const requiredRoomType = courseType.includes('sessional') ? 'Sessional' : 'Theory';
    return (room.room_type === requiredRoomType || room.room_type === 'Both') &&
      room.capacity >= totalStudents;
  }

  /** Department room rule (mirrors the frontend pickers):
   *  - home-dept course (code starts with CSE) -> home-department rooms only
   *  - other course (e.g. "EEE 1270")          -> home rooms + that department's rooms */
  private roomAllowedForCourse(room: Room, courseCode: string, ctx: SchedulingContext): boolean {
    const roomDept = room.department_id
      ? (ctx.deptShortById.get(room.department_id) ?? HOME_DEPT_SHORT_NAME)
      : HOME_DEPT_SHORT_NAME;
    if (roomDept === HOME_DEPT_SHORT_NAME) return true;
    const m = (courseCode ?? '').trim().match(/^[A-Za-z]+/);
    const courseDept = m ? m[0].toUpperCase() : HOME_DEPT_SHORT_NAME;
    return roomDept === courseDept;
  }

  private getWeekPattern(courseType: string): 'EVERY' | 'EVEN' | 'ODD' {
    // For sessional_0.75, we'll alternate between EVEN and ODD, or pick based on other sections
    if (courseType === 'sessional_0.75') {
      return 'EVEN';
    }
    return 'EVERY';
  }

  private async saveSlot(
    semesterId: string,
    target: PlacementTarget,
    room: Room,
    day: string,
    period: Pick<Period, 'start' | 'end'>,
    week?: 'EVERY' | 'EVEN' | 'ODD',
  ): Promise<void> {
    await this.classSlotRepository.save({
      semester_id: semesterId,
      course_id: target.courseId,
      section_id: target.sectionId,
      lab_section_id: target.labSectionId,
      room_id: room.id,
      day,
      start: period.start,
      end: period.end,
      week: week || this.getWeekPattern(target.courseType),
      locked: false,
    });
  }

  private async runConflictResolution(
    ctx: SchedulingContext,
    failures: FailedPlacement[],
  ): Promise<number> {
    this.addLog(`--- Conflict resolution: retrying ${failures.length} unplaced slot(s) ---`);
    let resolved = 0;

    for (const failure of failures) {
      await this.waitWhilePaused();
      if (this.stopFlag) break;

      const success = await this.resolveFailedSlot(ctx, failure);

      if (success) {
        resolved++;
        this.progress.generatedSlots++;
        this.progress.failedSlots--;
        const idx = this.conflictsEncountered.indexOf(`${failure.target.label}: No available time/room slot`);
        if (idx !== -1) this.conflictsEncountered.splice(idx, 1);
        this.addLog(`RESOLVED: ${failure.target.label} placed successfully during conflict resolution.`);
      } else {
        this.addLog(`UNRESOLVED: ${failure.target.label} still has no valid time/room combination.`);
      }
    }

    this.addLog(`--- Conflict resolution finished: ${resolved}/${failures.length} resolved ---`);
    return resolved;
  }

  private async resolveFailedSlot(
    ctx: SchedulingContext,
    failure: FailedPlacement,
  ): Promise<boolean> {
    const { target, assignedDays } = failure;
    const isSessional = target.courseType.includes('sessional');
    const requiredKind = isSessional ? 'sessional' : 'theory';
    const weekPatterns: ('EVERY' | 'EVEN' | 'ODD')[] = target.courseType === 'sessional_0.75' 
      ? ['EVEN', 'ODD', 'EVERY'] 
      : ['EVERY'];

    const fits = (r: Room) =>
      this.roomFits(r, target.courseType, target.totalStudents) &&
      this.roomAllowedForCourse(r, target.courseCode, ctx);

    // Departmental sections get departmental rooms and vice versa;
    // rooms of the other departmental type are only a last resort
    const matchedRooms = ctx.rooms
      .filter(r => fits(r) && r.departmental_type === target.deptType)
      .sort(() => Math.random() - 0.5);
    const fallbackRooms = ctx.rooms
      .filter(r => fits(r) && r.departmental_type !== target.deptType)
      .sort(() => Math.random() - 0.5);

    const shuffledDays = [...ctx.days].sort(() => Math.random() - 0.5);
    const candidatePeriods = this.eligiblePeriods(ctx.periods, requiredKind).sort(
      () => Math.random() - 0.5,
    );

    // Attempt 1: direct placement, departmental-matched rooms first
    for (const week of weekPatterns) {
      for (const roomPool of [matchedRooms, fallbackRooms]) {
        for (const day of shuffledDays) {
          if (assignedDays.includes(day.name)) continue;

          for (const period of candidatePeriods) {
            if (await this.hasSectionOrTeacherConflict(ctx, day.name, period, target.coveredSectionIds, target.teacherIds, week)) {
              continue;
            }

            for (const room of roomPool) {
              if (await this.hasRoomConflict(ctx, day.name, period, room, week)) continue;
              await this.saveSlot(ctx.semesterId, target, room, day.name, period, week);
              assignedDays.push(day.name);
              return true;
            }
          }
        }
      }
    }

    // Attempt 2: relocate a blocking class to another room to free up a slot
    for (const week of weekPatterns) {
      for (const day of shuffledDays) {
        if (assignedDays.includes(day.name)) continue;

        for (const period of candidatePeriods) {
          if (await this.hasSectionOrTeacherConflict(ctx, day.name, period, target.coveredSectionIds, target.teacherIds, week)) {
            continue;
          }

          for (const room of [...matchedRooms, ...fallbackRooms]) {
            // Only rooms blocked by another class can be freed, not declared-unavailable ones
            const roomUn = ctx.roomUnavail.find(u =>
              u.room_id === room.id &&
              u.days.includes(day.name) &&
              this.timesOverlap(u.start, u.end, period.start, period.end)
            );
            if (roomUn) continue;

            const roomSlots = await this.classSlotRepository.find({
              where: { semester_id: ctx.semesterId, day: day.name, room_id: room.id },
            });
            const occupants = roomSlots.filter(s =>
              this.timesOverlap(s.start, s.end, period.start, period.end) &&
              this.weeksOverlap(s.week, week)
            );
            // Only handle the single-blocker case to keep relocation safe
            if (occupants.length !== 1) continue;

            const moved = await this.tryRelocateSlot(ctx, occupants[0]);
            if (moved) {
              await this.saveSlot(ctx.semesterId, target, room, day.name, period, week);
              assignedDays.push(day.name);
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /** Move an existing slot (regular or lab-section) to a different room at the
   *  same day/time, keeping section/teacher constraints intact since the time
   *  does not change. */
  private async tryRelocateSlot(
    ctx: SchedulingContext,
    occupant: ClassSlot,
  ): Promise<boolean> {
    // Locked slots are user-pinned schedule entries; they must NEVER be
    // relocated by the generator, otherwise the lock contract is broken.
    if (occupant.locked) {
      return false;
    }

    const course = ctx.coursesById.get(occupant.course_id);
    if (!course) return false;

    let totalStudents: number;
    let deptType: 'Departmental' | 'Non-Departmental';
    let primaryRoomId: string | null;
    let coveredSectionIds: string[];
    let teacherIds: string[];

    if (occupant.lab_section_id) {
      const lab = ctx.labSectionsById.get(occupant.lab_section_id);
      if (!lab) return false;
      const mappedSections = lab.section_ids
        .map(id => ctx.sectionsById.get(id))
        .filter((s): s is Section => !!s);
      totalStudents = this.labSectionStudents(course, ctx);
      deptType = mappedSections[0]?.departmental_type ?? 'Departmental';
      primaryRoomId = lab.primary_room_id;
      coveredSectionIds = lab.section_ids;
      teacherIds = lab.teacher_ids;
    } else if (occupant.section_id) {
      const cst = ctx.cstByKey.get(`${occupant.course_id}:${occupant.section_id}`);
      if (!cst) return false;
      totalStudents = cst.section.total_students;
      deptType = cst.section.departmental_type;
      primaryRoomId = cst.primary_room_id;
      coveredSectionIds = [occupant.section_id];
      teacherIds = cst.teacher_ids;
    } else {
      return false;
    }

    // Don't evict a class from its preferred room
    if (primaryRoomId && primaryRoomId === occupant.room_id) return false;

    const candidates = ctx.rooms
      .filter(r =>
        r.id !== occupant.room_id &&
        this.roomFits(r, course.course_type, totalStudents) &&
        this.roomAllowedForCourse(r, course.code, ctx)
      )
      .sort(() => Math.random() - 0.5)
      .sort((a, b) =>
        (a.departmental_type === deptType ? 0 : 1) -
        (b.departmental_type === deptType ? 0 : 1)
      );

    for (const newRoom of candidates) {
      const period = { start: occupant.start, end: occupant.end };
      // Check conflicts for the original week pattern of the occupant
      if (await this.hasRoomConflict(ctx, occupant.day, period, newRoom, occupant.week)) continue;
      if (await this.hasSectionOrTeacherConflict(ctx, occupant.day, period, coveredSectionIds, teacherIds, occupant.week)) continue;

      await this.classSlotRepository.update(occupant.id, { room_id: newRoom.id });
      this.addLog(`Relocated ${course.code} (${occupant.day} ${occupant.start}) to room ${newRoom.name} to free a slot.`);
      return true;
    }

    return false;
  }

  private timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    const toMin = (t: string) => {
      if (!t) return 0;
      const cleanTime = t.replace(/[AP]M/i, "").trim();
      const parts = cleanTime.includes(":") ? cleanTime.split(":") : cleanTime.split(".");
      const h = Number(parts[0] || 0);
      const m = Number(parts[1] || 0);
      return h * 60 + m;
    };

    const as = toMin(aStart);
    let ae = toMin(aEnd);
    const bs = toMin(bStart);
    let be = toMin(bEnd);

    if (ae <= as) ae += 24 * 60;
    if (be <= bs) be += 24 * 60;

    return as < be && bs < ae;
  }

  private weeksOverlap(w1: string, w2: string): boolean {
    if (w1 === 'EVERY' || w2 === 'EVERY') return true;
    return w1 === w2;
  }
}
