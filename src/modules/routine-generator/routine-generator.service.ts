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
    conflictsEncountered: string[];
  };
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

  async start(semesterId: string) {
    if (this.progress.status === GeneratorStatus.RUNNING) {
      return;
    }

    this.resetState();
    this.progress.status = GeneratorStatus.RUNNING;
    this.progress.startTime = new Date();
    this.addLog('Starting routine generation...');

    // Run in background
    this.runGeneration(semesterId).catch((err) => {
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

  private async runGeneration(semesterId: string) {
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
          total += 1; // Sessional usually 1 slot
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

        const slotsNeeded = isSessional ? 1 : Math.ceil(assignment.course.credit);
        const assignedDays: string[] = [];

        for (let i = 0; i < slotsNeeded; i++) {
          while (this.pauseFlag && !this.stopFlag) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          if (this.stopFlag) break;

          const success = await this.generateSlot(
            semesterId,
            assignment,
            assignedDays,
            days,
            periods,
            rooms,
            teacherUnavail,
            roomUnavail
          );

          if (success) {
            this.progress.generatedSlots++;
            const courseInfo = `${assignment.course.code} (L${assignment.section.level} T${assignment.section.term} Sec ${assignment.section.name})`;
            this.addLog(`Slot ${i + 1}/${slotsNeeded} for ${courseInfo} assigned successfully.`);
          } else {
            this.progress.failedSlots++;
            this.addLog(`FAILED to assign slot ${i + 1}/${slotsNeeded} for ${assignment.course.code}. No available combination found.`);
            this.conflictsEncountered.push(`${assignment.course.code}: No available time/room slot`);
          }
        }
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
    roomUnavail: RoomUnavailability[]
  ): Promise<boolean> {
    const isSessional = assignment.course.course_type.includes('sessional');
    
    // Shuffle days and periods to avoid always picking the first one
    const shuffledDays = [...days].sort(() => Math.random() - 0.5);
    const shuffledPeriods = [...periods].sort(() => Math.random() - 0.5);

    for (const day of shuffledDays) {
      // Constraint: multiple classes of same course must be on different days
      if (assignedDays.includes(day.name)) continue;

      for (const period of shuffledPeriods) {
        // Skip break periods
        if (period.name.toLowerCase().includes('break')) continue;

        // Determine required room type
        const requiredRoomType = isSessional ? 'Sessional' : 'Theory';

        // Preferred room check
        let candidateRooms = [];
        if (assignment.primary_room_id) {
          const primaryRoom = rooms.find(r => r.id === assignment.primary_room_id);
          if (primaryRoom) candidateRooms.push(primaryRoom);
        }
        
        // Add other rooms that match type and capacity
        candidateRooms.push(...rooms.filter(r => 
          r.id !== assignment.primary_room_id && 
          r.room_type === requiredRoomType &&
          r.capacity >= assignment.section.total_students
        ).sort(() => Math.random() - 0.5));

        for (const room of candidateRooms) {
          const hasConflicts = await this.checkConflicts(
            semesterId,
            day.name,
            period,
            room,
            assignment,
            teacherUnavail,
            roomUnavail
          );

          if (!hasConflicts) {
            // Success! Create the slot
            await this.classSlotRepository.save({
              semester_id: semesterId,
              course_id: assignment.course_id,
              section_id: assignment.section_id,
              room_id: room.id,
              day: day.name,
              start: period.start,
              end: period.end,
              week: 'EVERY',
            });
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
    roomUnavail: RoomUnavailability[]
  ): Promise<boolean> {
    // 1. Room conflict (already assigned)
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

    // 2. Room unavailability
    const roomUn = roomUnavail.find(u => 
      u.room_id === room.id && 
      u.days.includes(day) && 
      this.timesOverlap(u.start, u.end, period.start, period.end)
    );
    if (roomUn) return true;

    // 3. Section conflict
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

    // 4. Teacher conflict
    for (const teacherId of assignment.teacher_ids) {
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

  private timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1);
  }
}
