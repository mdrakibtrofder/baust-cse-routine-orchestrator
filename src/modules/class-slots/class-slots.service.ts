import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
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

    const cst = await this.cstRepository.findOne({
      where: {
        semester_id: dto.semester_id || slot.semester_id,
        course_id: dto.course_id || slot.course_id,
        section_id: dto.section_id || slot.section_id,
      },
    });

    const teacherIds = cst ? cst.teacher_ids : [];

    const conflictDto: CheckConflictsDto = {
      semester_id: dto.semester_id || slot.semester_id,
      course_id: dto.course_id || slot.course_id,
      section_id: dto.section_id || slot.section_id,
      day: dto.day || slot.day,
      start: dto.start || slot.start,
      end: dto.end || slot.end,
      room_id: dto.room_id !== undefined ? dto.room_id : slot.room_id,
      week: dto.week || slot.week,
      teacher_ids: teacherIds,
      ignoreSlotId: id,
    };

    const conflicts = await this.checkConflicts(conflictDto);
    if (conflicts.length > 0) {
      throw new ConflictException({ message: 'Conflicts detected', conflicts });
    }

    Object.assign(slot, dto);
    return this.classSlotRepository.save(slot);
  }

  async delete(id: string): Promise<void> {
    const slot = await this.findById(id);
    await this.classSlotRepository.remove(slot);
  }

  async deleteForCourseSection(courseId: string, sectionId: string, semesterId: string): Promise<void> {
    await this.classSlotRepository.delete({
      semester_id: semesterId,
      course_id: courseId,
      section_id: sectionId,
    });
  }

  async checkConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const course = await this.courseRepository.findOne({ where: { id: dto.course_id } });
    const section = await this.sectionRepository.findOne({ where: { id: dto.section_id } });

    if (!course || !section) {
      return [];
    }

    if (dto.room_id) {
      const room = await this.roomRepository.findOne({ where: { id: dto.room_id } });
      if (room) {
        if (room.capacity < section.total_students) {
          conflicts.push({
            type: 'room_capacity',
            message: `Room ${room.name} capacity (${room.capacity}) < section students (${section.total_students})`,
          });
        }

        const isTheory = course.course_type.includes('theory');
        const isSessional = course.course_type.includes('sessional');
        if ((isTheory && room.room_type !== 'Theory') || (isSessional && room.room_type !== 'Sessional')) {
          conflicts.push({
            type: 'room_type',
            message: `Room ${room.name} is ${room.room_type} but course needs ${isTheory ? 'Theory' : 'Sessional'}`,
          });
        }

        const roomConflicts = await this.checkRoomConflicts(dto);
        conflicts.push(...roomConflicts);
      }
    }

    if (dto.teacher_ids && dto.teacher_ids.length > 0) {
      const teacherConflicts = await this.checkTeacherConflicts(dto);
      conflicts.push(...teacherConflicts);
    }

    const sectionConflicts = await this.checkSectionConflicts(dto);
    conflicts.push(...sectionConflicts);

    return conflicts;
  }

  private async checkRoomConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const overlappingSlots = await this.classSlotRepository.find({
      where: {
        semester_id: dto.semester_id,
        room_id: dto.room_id,
        day: dto.day,
      },
      relations: ['course', 'section'],
    });

    for (const slot of overlappingSlots) {
      if (slot.id === dto.ignoreSlotId) continue;
      if (!this.timesOverlap(slot.start, slot.end, dto.start, dto.end)) continue;
      if (!this.weeksOverlap(slot.week, dto.week || 'EVERY')) continue;

      const room = await this.roomRepository.findOne({ where: { id: dto.room_id } });
      conflicts.push({
        type: 'room_double',
        message: `Room ${room?.name} already booked ${slot.day} ${slot.start}-${slot.end} by ${slot.course?.code} (Sec ${slot.section?.name})`,
      });
    }

    return conflicts;
  }

  private async checkTeacherConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const teacherSlots = await this.classSlotRepository.find({
      where: {
        semester_id: dto.semester_id,
        day: dto.day,
      },
      relations: ['course', 'section'],
    });

    for (const slot of teacherSlots) {
      if (slot.id === dto.ignoreSlotId) continue;

      const cst = await this.cstRepository.findOne({
        where: {
          semester_id: dto.semester_id,
          course_id: slot.course_id,
          section_id: slot.section_id,
        },
      });

      if (!cst) continue;

      const hasCommonTeacher = cst.teacher_ids.some(tid => dto.teacher_ids.includes(tid));
      if (!hasCommonTeacher) continue;

      if (!this.timesOverlap(slot.start, slot.end, dto.start, dto.end)) continue;
      if (!this.weeksOverlap(slot.week, dto.week || 'EVERY')) continue;

      conflicts.push({
        type: 'teacher_double',
        message: `Assigned teacher already has class ${slot.day} ${slot.start}-${slot.end}`,
      });
    }

    return conflicts;
  }

  private async checkSectionConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const sectionSlots = await this.classSlotRepository.find({
      where: {
        semester_id: dto.semester_id,
        section_id: dto.section_id,
        day: dto.day,
      },
      relations: ['course'],
    });

    for (const slot of sectionSlots) {
      if (slot.id === dto.ignoreSlotId) continue;
      if (!this.timesOverlap(slot.start, slot.end, dto.start, dto.end)) continue;
      if (!this.weeksOverlap(slot.week, dto.week || 'EVERY')) continue;

      conflicts.push({
        type: 'section_double',
        message: `Section already has class ${slot.day} ${slot.start}-${slot.end} for ${slot.course?.code}`,
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
