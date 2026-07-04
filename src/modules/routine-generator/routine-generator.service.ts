import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { Teacher } from '../../entities/teacher.entity';
import { Period } from '../../entities/period.entity';
import { Day } from '../../entities/day.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { TeacherUnavailability } from '../../entities/teacher-unavailability.entity';
import { RoomUnavailability } from '../../entities/room-unavailability.entity';

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

interface FailedPlacement {
  assignment: CourseSectionTeacher;
  slotTeacherIds?: string[];
  assignedDays: string[];
}

@Injectable()
export class RoutineGeneratorService {
  private readonly logger = new Logger(RoutineGeneratorService.name);
  private progress: GeneratorProgress = {
    status: GeneratorStatus.IDLE,
    totalSlots: 0,
    generatedSlots: 0,
    failedSlots: 0,
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
    @InjectRepository(TeacherUnavailability)
    private readonly teacherUnavailabilityRepository: Repository<TeacherUnavailability>,
    @InjectRepository(RoomUnavailability)
    private readonly roomUnavailabilityRepository: Repository<RoomUnavailability>,
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

  private async runGeneration(semesterId: string, resolveConflicts: boolean) {
    const backupSlots = await this.classSlotRepository.find({ where: { semester_id: semesterId } });
    
    try {
      // 1. Clear existing slots for the semester
      await this.classSlotRepository.delete({ semester_id: semesterId });
      this.addLog('Cleared existing class slots for this semester.');

      // 2. Fetch all required data
      const assignments = await this.cstRepository.find({
        where: { semester_id: semesterId },
        relations: ['course', 'section'],
      });

      const days = await this.dayRepository.find();
      const periods = await this.periodRepository.find({
        order: { start: 'ASC' }
      });
      const rooms = await this.roomRepository.find();
      const teacherUnavail = await this.teacherUnavailabilityRepository.find();
      const roomUnavail = await this.roomUnavailabilityRepository.find();

      // 3. Calculate total slots
      let total = 0;
      for (const a of assignments) {
        if (a.course.course_type.includes('theory')) {
          total += Math.ceil(a.course.credit);
        } else {
          total += a.course.course_type === 'sessional_3.0' ? 2 : 1;
        }
      }
      this.progress.totalSlots = total;

      // 4. Sort assignments: Sessionals first as they are harder to place
      assignments.sort((a, b) => {
        const typeA = a.course.course_type.includes('sessional') ? 0 : 1;
        const typeB = b.course.course_type.includes('sessional') ? 0 : 1;
        return typeA - typeB;
      });

      // 5. Iterate and generate
      const failedPlacements: FailedPlacement[] = [];
      for (const assignment of assignments) {
        if (this.stopFlag) break;

        const isSessional = assignment.course.course_type.includes('sessional');
        
        // Sessional requirement: at least one teacher assigned
        if (isSessional && (!assignment.teacher_ids || assignment.teacher_ids.length === 0)) {
          this.addLog(`SKIPPING ${assignment.course.code}: Sessional course must have at least one teacher assigned.`);
          this.progress.failedSlots += 1;
          this.conflictsEncountered.push(`${assignment.course.code}: No teacher assigned`);
          continue;
        }

        const slotsNeeded = isSessional
          ? assignment.course.course_type === 'sessional_3.0' ? 2 : 1
          : Math.ceil(assignment.course.credit);
        const assignedDays: string[] = [];

        const isSplit = assignment.course.course_type === 'sessional_3.0' &&
          Array.isArray(assignment.slot_teacher_ids) &&
          assignment.slot_teacher_ids.length > 0;

        for (let i = 0; i < slotsNeeded; i++) {
          while (this.pauseFlag && !this.stopFlag) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          if (this.stopFlag) break;

          // For split-teacher sessional_3.0, use per-slot teacher for conflict checking
          const slotTeacherIds = isSplit
            ? (assignment.slot_teacher_ids[i] ?? assignment.teacher_ids)
            : assignment.teacher_ids;

          const success = await this.generateSlot(
            semesterId,
            assignment,
            assignedDays,
            days,
            periods,
            rooms,
            teacherUnavail,
            roomUnavail,
            slotTeacherIds
          );

          if (success) {
            this.progress.generatedSlots++;
            const courseInfo = `${assignment.course.code} (L${assignment.section.level} T${assignment.section.term} Sec ${assignment.section.name})`;
            this.addLog(`Slot ${i + 1}/${slotsNeeded} for ${courseInfo} assigned successfully.`);
          } else {
            this.progress.failedSlots++;
            this.addLog(`FAILED to assign slot ${i + 1}/${slotsNeeded} for ${assignment.course.code}. No available combination found.`);
            this.conflictsEncountered.push(`${assignment.course.code}: No available time/room slot`);
            failedPlacements.push({ assignment, slotTeacherIds, assignedDays });
          }
        }
      }

      // 6. Optional second pass: try to resolve room/time conflicts left by the first pass
      let resolvedCount = 0;
      if (!this.stopFlag && resolveConflicts && failedPlacements.length > 0) {
        resolvedCount = await this.runConflictResolution(
          semesterId,
          failedPlacements,
          days,
          periods,
          rooms,
          teacherUnavail,
          roomUnavail,
        );
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
      await this.classSlotRepository.delete({ semester_id: semesterId });
      await this.classSlotRepository.save(backupSlots);
      
      this.progress.status = GeneratorStatus.FAILED;
      this.addLog(`Generation failed: ${err}`);
      throw err;
    }
  }

  private async generateSlot(
    semesterId: string,
    assignment: CourseSectionTeacher,
    assignedDays: string[],
    days: Day[],
    periods: Period[],
    rooms: Room[],
    teacherUnavail: TeacherUnavailability[],
    roomUnavail: RoomUnavailability[],
    slotTeacherIds?: string[]
  ): Promise<boolean> {
    const isSessional = assignment.course.course_type.includes('sessional');
    const effectiveTeacherIds = slotTeacherIds ?? assignment.teacher_ids;
    const requiredKind = isSessional ? 'sessional' : 'theory';
    const sectionDeptType = assignment.section.departmental_type;

    // Shuffle days and periods to avoid always picking the first one
    const shuffledDays = [...days].sort(() => Math.random() - 0.5);
    const shuffledPeriods = [...periods].sort(() => Math.random() - 0.5);

    for (const day of shuffledDays) {
      // Constraint: multiple classes of same course must be on different days
      if (assignedDays.includes(day.name)) continue;

      for (const period of shuffledPeriods) {
        // Skip break periods
        if (period.is_break || period.name.toLowerCase().includes('break')) continue;

        // Theory courses use theory periods, sessional courses use sessional periods
        if (period.kind !== requiredKind) continue;

        // Preferred room check
        const candidateRooms: Room[] = [];
        if (assignment.primary_room_id) {
          const primaryRoom = rooms.find(r => r.id === assignment.primary_room_id);
          if (primaryRoom) candidateRooms.push(primaryRoom);
        }

        // Add other rooms that match type (or are usable for both) and capacity,
        // preferring rooms whose departmental type matches the section's
        candidateRooms.push(...rooms.filter(r =>
          r.id !== assignment.primary_room_id &&
          this.roomFits(r, assignment.course.course_type, assignment.section.total_students)
        )
          .sort(() => Math.random() - 0.5)
          .sort((a, b) =>
            (a.departmental_type === sectionDeptType ? 0 : 1) -
            (b.departmental_type === sectionDeptType ? 0 : 1)
          ));

        for (const room of candidateRooms) {
          const hasConflicts = await this.checkConflicts(
            semesterId,
            day.name,
            period,
            room,
            assignment,
            teacherUnavail,
            roomUnavail,
            effectiveTeacherIds
          );

          if (!hasConflicts) {
            await this.saveSlot(semesterId, assignment, room, day.name, period);
            assignedDays.push(day.name);
            return true;
          }
        }
      }
    }

    return false;
  }

  private async checkConflicts(
    semesterId: string,
    day: string,
    period: Period,
    room: Room,
    assignment: CourseSectionTeacher,
    teacherUnavail: TeacherUnavailability[],
    roomUnavail: RoomUnavailability[],
    overrideTeacherIds?: string[]
  ): Promise<boolean> {
    if (await this.hasRoomConflict(semesterId, day, period, room, roomUnavail)) return true;
    return this.hasSectionOrTeacherConflict(semesterId, day, period, assignment, teacherUnavail, overrideTeacherIds);
  }

  private async hasRoomConflict(
    semesterId: string,
    day: string,
    period: Pick<Period, 'start' | 'end'>,
    room: Room,
    roomUnavail: RoomUnavailability[],
  ): Promise<boolean> {
    // Room conflict (already assigned)
    const roomConflict = await this.classSlotRepository.findOne({
      where: {
        semester_id: semesterId,
        day: day,
        room_id: room.id,
        start: period.start,
        end: period.end,
      }
    });
    if (roomConflict) return true;

    // Room unavailability
    const roomUn = roomUnavail.find(u =>
      u.room_id === room.id &&
      u.days.includes(day) &&
      this.timesOverlap(u.start, u.end, period.start, period.end)
    );
    return !!roomUn;
  }

  private async hasSectionOrTeacherConflict(
    semesterId: string,
    day: string,
    period: Pick<Period, 'start' | 'end'>,
    assignment: CourseSectionTeacher,
    teacherUnavail: TeacherUnavailability[],
    overrideTeacherIds?: string[]
  ): Promise<boolean> {
    // Section conflict
    const sectionConflict = await this.classSlotRepository.findOne({
      where: {
        semester_id: semesterId,
        day: day,
        section_id: assignment.section_id,
        start: period.start,
        end: period.end,
      }
    });
    if (sectionConflict) return true;

    // Teacher conflict
    const teacherIdsToCheck = overrideTeacherIds ?? assignment.teacher_ids;
    for (const teacherId of teacherIdsToCheck) {
      // Check if teacher assigned to another class
      const teacherSlots = await this.classSlotRepository.createQueryBuilder('slot')
        .innerJoin(CourseSectionTeacher, 'cst', 'cst.course_id = slot.course_id AND cst.section_id = slot.section_id AND cst.semester_id = slot.semester_id')
        .where('slot.semester_id = :semesterId', { semesterId })
        .andWhere('slot.day = :day', { day })
        .andWhere('slot.start = :start', { start: period.start })
        .andWhere('slot.end = :end', { end: period.end })
        .andWhere(':teacherId = ANY(cst.teacher_ids)', { teacherId })
        .getOne();

      if (teacherSlots) return true;

      // Check teacher unavailability
      const tUn = teacherUnavail.find(u =>
        u.teacher_id === teacherId &&
        u.day === day &&
        this.timesOverlap(u.start, u.end, period.start, period.end)
      );
      if (tUn) return true;
    }

    return false;
  }

  private roomFits(room: Room, courseType: string, totalStudents: number): boolean {
    const requiredRoomType = courseType.includes('sessional') ? 'Sessional' : 'Theory';
    return (room.room_type === requiredRoomType || room.room_type === 'Both') &&
      room.capacity >= totalStudents;
  }

  private async saveSlot(
    semesterId: string,
    assignment: CourseSectionTeacher,
    room: Room,
    day: string,
    period: Pick<Period, 'start' | 'end'>,
  ): Promise<void> {
    await this.classSlotRepository.save({
      semester_id: semesterId,
      course_id: assignment.course_id,
      section_id: assignment.section_id,
      room_id: room.id,
      day,
      start: period.start,
      end: period.end,
      week: 'EVERY' as const,
    });
  }

  private async runConflictResolution(
    semesterId: string,
    failures: FailedPlacement[],
    days: Day[],
    periods: Period[],
    rooms: Room[],
    teacherUnavail: TeacherUnavailability[],
    roomUnavail: RoomUnavailability[],
  ): Promise<number> {
    this.addLog(`--- Conflict resolution: retrying ${failures.length} unplaced slot(s) ---`);
    let resolved = 0;

    for (const failure of failures) {
      while (this.pauseFlag && !this.stopFlag) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (this.stopFlag) break;

      const { assignment } = failure;
      const courseInfo = `${assignment.course.code} (L${assignment.section.level} T${assignment.section.term} Sec ${assignment.section.name})`;

      const success = await this.resolveFailedSlot(
        semesterId,
        failure,
        days,
        periods,
        rooms,
        teacherUnavail,
        roomUnavail,
      );

      if (success) {
        resolved++;
        this.progress.generatedSlots++;
        this.progress.failedSlots--;
        const idx = this.conflictsEncountered.indexOf(`${assignment.course.code}: No available time/room slot`);
        if (idx !== -1) this.conflictsEncountered.splice(idx, 1);
        this.addLog(`RESOLVED: ${courseInfo} placed successfully during conflict resolution.`);
      } else {
        this.addLog(`UNRESOLVED: ${courseInfo} still has no valid time/room combination.`);
      }
    }

    this.addLog(`--- Conflict resolution finished: ${resolved}/${failures.length} resolved ---`);
    return resolved;
  }

  private async resolveFailedSlot(
    semesterId: string,
    failure: FailedPlacement,
    days: Day[],
    periods: Period[],
    rooms: Room[],
    teacherUnavail: TeacherUnavailability[],
    roomUnavail: RoomUnavailability[],
  ): Promise<boolean> {
    const { assignment, slotTeacherIds, assignedDays } = failure;
    const isSessional = assignment.course.course_type.includes('sessional');
    const requiredKind = isSessional ? 'sessional' : 'theory';
    const sectionDeptType = assignment.section.departmental_type;

    const fits = (r: Room) =>
      this.roomFits(r, assignment.course.course_type, assignment.section.total_students);

    // Departmental sections get departmental rooms and vice versa;
    // rooms of the other departmental type are only a last resort
    const matchedRooms = rooms
      .filter(r => fits(r) && r.departmental_type === sectionDeptType)
      .sort(() => Math.random() - 0.5);
    const fallbackRooms = rooms
      .filter(r => fits(r) && r.departmental_type !== sectionDeptType)
      .sort(() => Math.random() - 0.5);

    const shuffledDays = [...days].sort(() => Math.random() - 0.5);
    const candidatePeriods = periods
      .filter(p => !p.is_break && !p.name.toLowerCase().includes('break') && p.kind === requiredKind)
      .sort(() => Math.random() - 0.5);

    // Attempt 1: direct placement, departmental-matched rooms first
    for (const roomPool of [matchedRooms, fallbackRooms]) {
      for (const day of shuffledDays) {
        if (assignedDays.includes(day.name)) continue;

        for (const period of candidatePeriods) {
          if (await this.hasSectionOrTeacherConflict(semesterId, day.name, period, assignment, teacherUnavail, slotTeacherIds)) {
            continue;
          }

          for (const room of roomPool) {
            if (await this.hasRoomConflict(semesterId, day.name, period, room, roomUnavail)) continue;
            await this.saveSlot(semesterId, assignment, room, day.name, period);
            assignedDays.push(day.name);
            return true;
          }
        }
      }
    }

    // Attempt 2: relocate a blocking class to another room to free up a slot
    for (const day of shuffledDays) {
      if (assignedDays.includes(day.name)) continue;

      for (const period of candidatePeriods) {
        if (await this.hasSectionOrTeacherConflict(semesterId, day.name, period, assignment, teacherUnavail, slotTeacherIds)) {
          continue;
        }

        for (const room of [...matchedRooms, ...fallbackRooms]) {
          // Only rooms blocked by another class can be freed, not declared-unavailable ones
          const roomUn = roomUnavail.find(u =>
            u.room_id === room.id &&
            u.days.includes(day.name) &&
            this.timesOverlap(u.start, u.end, period.start, period.end)
          );
          if (roomUn) continue;

          const occupant = await this.classSlotRepository.findOne({
            where: {
              semester_id: semesterId,
              day: day.name,
              room_id: room.id,
              start: period.start,
              end: period.end,
            }
          });
          if (!occupant) continue;

          const moved = await this.tryRelocateSlot(semesterId, occupant, rooms, roomUnavail);
          if (moved) {
            await this.saveSlot(semesterId, assignment, room, day.name, period);
            assignedDays.push(day.name);
            return true;
          }
        }
      }
    }

    return false;
  }

  /** Move an existing slot to a different room at the same day/time, keeping
   *  section/teacher constraints intact since the time does not change. */
  private async tryRelocateSlot(
    semesterId: string,
    occupant: ClassSlot,
    rooms: Room[],
    roomUnavail: RoomUnavailability[],
  ): Promise<boolean> {
    // Lab-section slots are managed elsewhere; never move them
    if (!occupant.section_id) return false;

    const occupantCst = await this.cstRepository.findOne({
      where: {
        semester_id: semesterId,
        course_id: occupant.course_id,
        section_id: occupant.section_id,
      },
      relations: ['course', 'section'],
    });
    if (!occupantCst) return false;

    // Don't evict a class from its preferred room
    if (occupantCst.primary_room_id && occupantCst.primary_room_id === occupant.room_id) return false;

    const deptType = occupantCst.section.departmental_type;
    const candidates = rooms
      .filter(r =>
        r.id !== occupant.room_id &&
        this.roomFits(r, occupantCst.course.course_type, occupantCst.section.total_students)
      )
      .sort(() => Math.random() - 0.5)
      .sort((a, b) =>
        (a.departmental_type === deptType ? 0 : 1) -
        (b.departmental_type === deptType ? 0 : 1)
      );

    for (const newRoom of candidates) {
      const period = { start: occupant.start, end: occupant.end };
      if (await this.hasRoomConflict(semesterId, occupant.day, period, newRoom, roomUnavail)) continue;

      await this.classSlotRepository.update(occupant.id, { room_id: newRoom.id });
      this.addLog(`Relocated ${occupantCst.course.code} (${occupant.day} ${occupant.start}) to room ${newRoom.name} to free a slot.`);
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
}
