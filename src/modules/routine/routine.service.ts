import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Teacher } from '../../entities/teacher.entity';
import { Room } from '../../entities/room.entity';
import { Section } from '../../entities/section.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';

@Injectable()
export class RoutineService {
  constructor(
    @InjectRepository(ClassSlot) private classSlotRepo: Repository<ClassSlot>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
    @InjectRepository(Room) private roomRepo: Repository<Room>,
    @InjectRepository(Section) private sectionRepo: Repository<Section>,
    @InjectRepository(CourseSectionTeacher) private cstRepo: Repository<CourseSectionTeacher>,
  ) {}

  async getTeacherRoutine(teacherId: string, semesterId: string) {
    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Teacher not found');

    // Get regular assignments
    const assignments = await this.cstRepo.createQueryBuilder('cst')
      .where('cst.semester_id = :semesterId', { semesterId })
      .andWhere(':teacherId = ANY(cst.teacher_ids)', { teacherId })
      .getMany();

    // Get lab sections where this teacher is included
    const labSectionRepo = this.classSlotRepo.manager.getRepository('course_lab_sections');
    const labSections = await labSectionRepo.createQueryBuilder('ls')
      .where('ls.semester_id = :semesterId', { semesterId })
      .andWhere(':teacherId = ANY(ls.teacher_ids)', { teacherId })
      .getMany();
    const labSectionIds = labSections.map(ls => ls.id);

    if (assignments.length === 0 && labSections.length === 0) {
      return { teacher, classes: [] };
    }

    const courseSectionPairs = assignments.map(a => ({
      course_id: a.course_id,
      section_id: a.section_id
    }));

    // Find slots matching these assignments OR lab sections
    const query = this.classSlotRepo.createQueryBuilder('slot')
      .leftJoinAndSelect('slot.course', 'course')
      .leftJoinAndSelect('slot.section', 'section')
      .leftJoinAndSelect('slot.room', 'room')
      .where('slot.semester_id = :semesterId', { semesterId });

    query.andWhere(new Brackets(qb => {
      if (courseSectionPairs.length > 0) {
        courseSectionPairs.forEach((pair, index) => {
          const condition = `(slot.course_id = :courseId${index} AND slot.section_id = :sectionId${index})`;
          if (index === 0) {
            qb.where(condition, { [`courseId${index}`]: pair.course_id, [`sectionId${index}`]: pair.section_id });
          } else {
            qb.orWhere(condition, { [`courseId${index}`]: pair.course_id, [`sectionId${index}`]: pair.section_id });
          }
        });
      }
      if (labSectionIds.length > 0) {
        if (courseSectionPairs.length > 0) {
          qb.orWhere('slot.lab_section_id IN (:...labSectionIds)', { labSectionIds });
        } else {
          qb.where('slot.lab_section_id IN (:...labSectionIds)', { labSectionIds });
        }
      }
    }));

    const slots = await query.orderBy('slot.day', 'ASC').addOrderBy('slot.start', 'ASC').getMany();

    return { teacher, classes: slots };
  }

  async getRoomRoutine(roomId: string, semesterId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    const slots = await this.classSlotRepo.find({
      where: { semester_id: semesterId, room_id: roomId },
      relations: ['course', 'section'],
      order: { day: 'ASC', start: 'ASC' },
    });

    return { room, classes: slots };
  }

  async getSectionRoutine(sectionId: string, semesterId: string) {
    const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
    if (!section) throw new NotFoundException('Section not found');

    const slots = await this.classSlotRepo.find({
      where: { semester_id: semesterId, section_id: sectionId },
      relations: ['course', 'room'],
      order: { day: 'ASC', start: 'ASC' },
    });

    return { section, classes: slots };
  }

  async getSemesterRoutine(semesterId: string) {
    const slots = await this.classSlotRepo.find({
      where: { semester_id: semesterId },
      relations: ['course', 'section', 'room'],
      order: { day: 'ASC', start: 'ASC' },
    });

    return { semester_id: semesterId, classes: slots };
  }
}
