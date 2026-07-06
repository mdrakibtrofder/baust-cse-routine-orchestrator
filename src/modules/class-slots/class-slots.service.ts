import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { TeacherUnavailability } from '../../entities/teacher-unavailability.entity';
import { RoomUnavailability } from '../../entities/room-unavailability.entity';
import { CourseLabSection } from '../../entities/course-lab-section.entity';
import { CreateClassSlotDto } from '../../dtos/class-slot.dto';
import { UpdateClassSlotDto } from '../../dtos/update-dtos/update-class-slot.dto';
import { CheckConflictsDto } from '../../dtos/check-conflicts.dto';
import { Conflict } from './interfaces/conflict.interface';

@Injectable()
export class ClassSlotsService {
  constructor(
    @InjectRepository(ClassSlot)
    private readonly classSlotRepository: Repository<ClassSlot>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(CourseSectionTeacher)
    private readonly cstRepository: Repository<CourseSectionTeacher>,
    @InjectRepository(TeacherUnavailability)
    private readonly teacherUnavailabilityRepository: Repository<TeacherUnavailability>,
    @InjectRepository(RoomUnavailability)
    private readonly roomUnavailabilityRepository: Repository<RoomUnavailability>,
    @InjectRepository(CourseLabSection)
    private readonly labSectionRepository: Repository<CourseLabSection>,
    private readonly dataSource: DataSource,
  ) {}

  async findBySemester(semesterId: string): Promise<ClassSlot[]> {
    return this.classSlotRepository.find({
      where: { semester_id: semesterId },
      relations: ['course', 'section', 'room'],
    });
  }

  async findById(id: string): Promise<ClassSlot> {
    const slot = await this.classSlotRepository.findOne({
      where: { id },
      relations: ['course', 'section', 'room', 'semester'],
    });
    if (!slot) {
      throw new NotFoundException(`Class slot with ID ${id} not found`);
    }
    return slot;
  }

  async create(dto: CreateClassSlotDto): Promise<ClassSlot> {
    // Check for conflicts
    const cst = await this.cstRepository.findOne({
      where: {
        semester_id: dto.semester_id,
        course_id: dto.course_id,
        section_id: dto.section_id,
      },
    });

    const teacherIds = cst ? cst.teacher_ids : [];

    const conflictDto: CheckConflictsDto = {
      ...dto,
      teacher_ids: teacherIds,
    };

    const conflicts = await this.checkConflicts(conflictDto);
    if (conflicts.length > 0) {
      throw new ConflictException({ message: 'Conflicts detected', conflicts });
    }

    const slot = this.classSlotRepository.create({
      ...dto,
      week: dto.week || 'EVERY',
    });

    return this.classSlotRepository.save(slot);
  }

  async update(id: string, dto: UpdateClassSlotDto): Promise<ClassSlot> {
    const slot = await this.findById(id);

    // Check if only locked is being modified - compare all keys!
    let onlyModifyingLocked = true;
    for (const key of Object.keys(dto)) {
      if (key === 'locked') continue;
      // @ts-ignore
      if (dto[key] !== slot[key]) {
        onlyModifyingLocked = false;
        break;
      }
    }

    if (!onlyModifyingLocked) {
      // Get teacher ids - check if it's a lab slot or regular
      let teacherIds: string[] = [];
      if (slot.lab_section_id) {
        const labSection = await this.labSectionRepository?.findOne({ 
          where: { id: slot.lab_section_id } 
        });
        teacherIds = labSection?.teacher_ids ?? [];
      } else {
        const cst = await this.cstRepository.findOne({
          where: {
            semester_id: dto.semester_id || slot.semester_id,
            course_id: dto.course_id || slot.course_id,
            section_id: dto.section_id || slot.section_id,
          },
        });
        teacherIds = cst ? cst.teacher_ids : [];
      }

      const conflictDto: CheckConflictsDto = {
        semester_id: dto.semester_id || slot.semester_id,
        course_id: dto.course_id || slot.course_id,
        section_id: dto.section_id || slot.section_id,
        lab_section_id: dto.lab_section_id || slot.lab_section_id,
        day: dto.day || slot.day,
        start: dto.start || slot.start,
        end: dto.end || slot.end,
        room_id: dto.room_id !== undefined ? dto.room_id : slot.room_id,
        week: dto.week || slot.week,
        teacher_ids: teacherIds,
        ignoreSlotId: id,
        ignoreCourseSectionSlots: true,
      };

      const conflicts = await this.checkConflicts(conflictDto);
      if (conflicts.length > 0) {
        throw new ConflictException({ message: 'Conflicts detected', conflicts });
      }
    }

    Object.assign(slot, dto);
    return this.classSlotRepository.save(slot);
  }

  async delete(id: string): Promise<void> {
    const slot = await this.findById(id);
    await this.classSlotRepository.remove(slot);
  }

  async deleteForCourseSection(courseId: string, sectionId: string, semesterId: string): Promise<void> {
    await this.classSlotRepository
      .createQueryBuilder()
      .delete()
      .where('semester_id = :semesterId', { semesterId })
      .andWhere('course_id = :courseId', { courseId })
      .andWhere('section_id = :sectionId', { sectionId })
      .andWhere('locked = :locked', { locked: false })
      .execute();
  }

  /**
   * Atomically replace all class slots for a course-section, preserving locked slots.
   * When force=false (default), throws ConflictException if any slot has conflicts.
   * When force=true, skips conflict validation and saves regardless.
   */
  async batchReplace(
    semesterId: string,
    courseId: string,
    sectionId: string,
    slots: Array<{ day: string; start: string; end: string; room_id: string; week?: string }>,
    force = false,
  ): Promise<ClassSlot[]> {
    if (!force) {
      const cst = await this.cstRepository.findOne({
        where: { semester_id: semesterId, course_id: courseId, section_id: sectionId },
      });
      const teacherIds = cst ? cst.teacher_ids : [];

      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const conflictDto: CheckConflictsDto = {
          semester_id: semesterId,
          course_id: courseId,
          section_id: sectionId,
          day: s.day,
          start: s.start,
          end: s.end,
          room_id: s.room_id,
          week: (s.week || 'EVERY') as any,
          teacher_ids: teacherIds,
          ignoreCourseSectionSlots: true,
          siblingSlots: slots
            .filter((_, j) => j !== i)
            .map((x, j) => ({
              id: `__sibling_${j}__`,
              day: x.day, start: x.start, end: x.end,
              week: x.week || 'EVERY',
              semester_id: semesterId, course_id: courseId, section_id: sectionId,
            })),
        };
        const conflicts = await this.checkConflicts(conflictDto);
        if (conflicts.length > 0) {
          throw new ConflictException({
            message: `Class ${i + 1} has conflicts: ${conflicts.map((c) => c.message).join('; ')}`,
          });
        }
      }
    }

    return this.dataSource.transaction(async (manager) => {
      // Fetch existing slots to keep locked ones
      const existingSlots = await manager.find(ClassSlot, {
        where: {
          semester_id: semesterId,
          course_id: courseId,
          section_id: sectionId,
          lab_section_id: null,
        },
      });
      
      const lockedSlots = existingSlots.filter(s => s.locked);
      
      // Delete non-locked slots
      await manager
        .createQueryBuilder()
        .delete()
        .from(ClassSlot)
        .where('semester_id = :semesterId AND course_id = :courseId AND section_id = :sectionId AND lab_section_id IS NULL AND locked = false', {
          semesterId,
          courseId,
          sectionId,
        })
        .execute();
        
      // Create new non-locked slots
      const newEntities = slots.map((s) =>
        manager.create(ClassSlot, {
          semester_id: semesterId,
          course_id: courseId,
          section_id: sectionId,
          day: s.day,
          start: s.start,
          end: s.end,
          room_id: s.room_id,
          week: (s.week || 'EVERY') as any,
          locked: false,
        }),
      );
      
      // Save new slots and keep locked ones
      const savedNew = await manager.save(ClassSlot, newEntities);
      return [...lockedSlots, ...savedNew];
    });
  }

  async checkConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const course = await this.courseRepository.findOne({ where: { id: dto.course_id } });

    if (!course) {
      return [];
    }

    // Get total students - if lab section, get sum of all linked sections
    let totalStudents = 0;
    let isLab = false;
    if (dto.lab_section_id) {
      isLab = true;
      const labSection = await this.labSectionRepository.findOne({
        where: { id: dto.lab_section_id },
      });
      if (labSection?.section_ids.length) {
        const sections = await this.sectionRepository.findByIds(labSection.section_ids);
        totalStudents = sections.reduce((sum, s) => sum + s.total_students, 0);
      }
    } else if (dto.section_id) {
      const section = await this.sectionRepository.findOne({ where: { id: dto.section_id } });
      totalStudents = section?.total_students ?? 0;
    }

    if (dto.room_id) {
      const room = await this.roomRepository.findOne({ where: { id: dto.room_id } });
      if (room) {
        if (room.capacity < totalStudents) {
          conflicts.push({
            type: 'room_capacity',
            message: `Room ${room.name} capacity (${room.capacity}) < total students (${totalStudents})`,
          });
        }

        const isTheory = course.course_type.includes('theory');
        const isSessional = course.course_type.includes('sessional');
        const roomOk = room.room_type === 'Both' || (isTheory && room.room_type === 'Theory') || (isSessional && room.room_type === 'Sessional');
        if (!roomOk) {
          conflicts.push({
            type: 'room_type',
            message: `Room ${room.name} is ${room.room_type} but course needs ${isTheory ? 'Theory' : 'Sessional'}`,
          });
        }

        const roomConflicts = await this.checkRoomConflicts(dto);
        conflicts.push(...roomConflicts);

        const roomUnavailability = await this.checkRoomUnavailability(dto);
        conflicts.push(...roomUnavailability);
      }
    }

    if (dto.teacher_ids && dto.teacher_ids.length > 0) {
      const teacherConflicts = await this.checkTeacherConflicts(dto);
      conflicts.push(...teacherConflicts);

      const teacherUnavailability = await this.checkTeacherUnavailability(dto);
      conflicts.push(...teacherUnavailability);
    }

    if (!isLab) {
      const sectionConflicts = await this.checkSectionConflicts(dto);
      conflicts.push(...sectionConflicts);
    }

    return conflicts;
  }

  private async checkRoomConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const room = await this.roomRepository.findOne({ where: { id: dto.room_id } });

    const dbSlots = await this.classSlotRepository.find({
      where: { semester_id: dto.semester_id, room_id: dto.room_id, day: dto.day },
      relations: ['course', 'section'],
    });
    const siblings = (dto.siblingSlots ?? []).filter((s) => s.day === dto.day);
    const allSlots = [...dbSlots, ...siblings];

    for (const slot of allSlots) {
      if (slot.id === dto.ignoreSlotId) continue;
      // Check if we should ignore this slot
      const shouldIgnore = 
        (dto.ignoreCourseSectionSlots && 
          slot.course_id === dto.course_id && 
          (
            (dto.section_id && slot.section_id === dto.section_id) || 
            (dto.lab_section_id && slot.lab_section_id === dto.lab_section_id)
          )
        );
      if (shouldIgnore) continue;
      if (!this.timesOverlap(slot.start, slot.end, dto.start, dto.end)) continue;
      if (!this.weeksOverlap(slot.week, dto.week || 'EVERY')) continue;
      const courseLabel = (slot as any).course ? `${(slot as any).course?.code} - ${(slot as any).course?.name}` : 'another course';
      const sectionLabel = (slot as any).section ? `Level ${(slot as any).section?.level} Term ${(slot as any).section?.term} Sec ${(slot as any).section?.name}` : 'Lab';
      conflicts.push({
        type: 'room_double',
        message: `Room ${room?.name} already booked ${slot.day} ${slot.start}-${slot.end} by ${courseLabel} (${sectionLabel})`,
      });
    }

    return conflicts;
  }

  private async checkTeacherConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const dbSlots = await this.classSlotRepository.find({
      where: { semester_id: dto.semester_id, day: dto.day },
      relations: ['course', 'section'],
    });
    const siblings = (dto.siblingSlots ?? []).filter((s) => s.day === dto.day);
    const allSlots = [...dbSlots, ...siblings];

    for (const slot of allSlots) {
      if (slot.id === dto.ignoreSlotId) continue;
      if (dto.ignoreCourseSectionSlots && slot.course_id === dto.course_id && slot.section_id === dto.section_id) continue;

      // Get teacher ids for this slot - check if it's a lab slot or regular
      let slotTeacherIds: string[] = [];
      if (slot.lab_section_id) {
        const labSection = await this.labSectionRepository.findOne({
          where: { id: slot.lab_section_id },
        });
        slotTeacherIds = labSection?.teacher_ids ?? [];
      } else {
        const cst = await this.cstRepository.findOne({
          where: { semester_id: dto.semester_id, course_id: slot.course_id, section_id: slot.section_id },
        });
        slotTeacherIds = cst?.teacher_ids ?? [];
      }

      if (!slotTeacherIds.some((tid) => dto.teacher_ids.includes(tid))) continue;
      if (!this.timesOverlap(slot.start, slot.end, dto.start, dto.end)) continue;
      if (!this.weeksOverlap(slot.week, dto.week || 'EVERY')) continue;

      const courseLabel = (slot as any).course ? `${(slot as any).course?.code} - ${(slot as any).course?.name}` : 'another course';
      const sectionLabel = (slot as any).section ? `Level ${(slot as any).section?.level} Term ${(slot as any).section?.term} Sec ${(slot as any).section?.name}` : 'Lab';
      conflicts.push({
        type: 'teacher_double',
        message: `Assigned teacher already has class ${courseLabel} (${sectionLabel}) ${slot.day} ${slot.start}-${slot.end}`,
      });
    }

    return conflicts;
  }

  private async checkTeacherUnavailability(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const unavailabilities = await this.teacherUnavailabilityRepository.find({
      where: { day: dto.day },
    });

    for (const tid of dto.teacher_ids) {
      const teacherUnavail = unavailabilities.filter(u => u.teacher_id === tid);
      for (const u of teacherUnavail) {
        if (this.timesOverlap(u.start, u.end, dto.start, dto.end)) {
          conflicts.push({
            type: 'teacher_unavailable',
            message: `Teacher is unavailable on ${dto.day} ${u.start}-${u.end}${u.reason ? ` (${u.reason})` : ''}`,
          });
        }
      }
    }
    return conflicts;
  }

  private async checkRoomUnavailability(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const unavailabilities = await this.roomUnavailabilityRepository.find({
      where: { room_id: dto.room_id },
    });

    for (const u of unavailabilities) {
      if (u.days.includes(dto.day)) {
        if (this.timesOverlap(u.start, u.end, dto.start, dto.end)) {
          conflicts.push({
            type: 'room_unavailable',
            message: `Room is unavailable on ${dto.day} ${u.start}-${u.end}${u.reason ? ` (${u.reason})` : ''}`,
          });
        }
      }
    }
    return conflicts;
  }

  private async checkSectionConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const dbSlots = await this.classSlotRepository.find({
      where: { semester_id: dto.semester_id, section_id: dto.section_id, day: dto.day },
      relations: ['course', 'section'],
    });
    const siblings = (dto.siblingSlots ?? []).filter((s) => s.day === dto.day && s.section_id === dto.section_id);
    const allSlots = [...dbSlots, ...siblings];

    for (const slot of allSlots) {
      if (slot.id === dto.ignoreSlotId) continue;
      if (dto.ignoreCourseSectionSlots && slot.course_id === dto.course_id && slot.section_id === dto.section_id) continue;
      if (!this.timesOverlap(slot.start, slot.end, dto.start, dto.end)) continue;
      if (!this.weeksOverlap(slot.week, dto.week || 'EVERY')) continue;

      const courseLabel = (slot as any).course ? `${(slot as any).course?.code} - ${(slot as any).course?.name}` : 'another course';
      const sectionLabel = (slot as any).section ? `Level ${(slot as any).section?.level} Term ${(slot as any).section?.term} Sec ${(slot as any).section?.name}` : 'Lab';
      conflicts.push({
        type: 'section_double',
        message: `Section ${sectionLabel} already has class ${courseLabel} ${slot.day} ${slot.start}-${slot.end}`,
      });
    }

    return conflicts;
  }

  private timesOverlap(s1Start: string, s1End: string, s2Start: string, s2End: string): boolean {
    const toMin = (time: string) => {
      const parts = time.split(':');
      const h = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      return h * 60 + m;
    };
    return toMin(s1Start) < toMin(s2End) && toMin(s2Start) < toMin(s1End);
  }

  private weeksOverlap(w1: string, w2: string): boolean {
    if (w1 === 'EVERY' || w2 === 'EVERY') return true;
    return w1 === w2;
  }
}
