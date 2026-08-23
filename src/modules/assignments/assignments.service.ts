import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { CreateAssignmentDto } from '../../dtos/assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(CourseSectionTeacher)
    private readonly cstRepository: Repository<CourseSectionTeacher>,
  ) {}

  async findBySemester(semesterId: string) {
    return this.cstRepository.find({
      where: { semester_id: semesterId },
      relations: ['course', 'section'],
    });
  }

  async getForCourseSection(courseId: string, sectionId: string, semesterId: string) {
    return this.cstRepository.findOne({
      where: {
        semester_id: semesterId,
        course_id: courseId,
        section_id: sectionId,
      },
      relations: ['course', 'section'],
    });
  }

  async createOrUpdate(dto: CreateAssignmentDto) {
    let assignment = await this.cstRepository.findOne({
      where: {
        semester_id: dto.semester_id,
        course_id: dto.course_id,
        section_id: dto.section_id,
      },
    });

    if (assignment) {
      assignment.teacher_ids = dto.teacher_ids;
      assignment.slot_teacher_ids = dto.slot_teacher_ids ?? null;
      assignment.combined_section_ids = dto.combined_section_ids ?? null;
    } else {
      assignment = this.cstRepository.create(dto);
    }

    return this.cstRepository.save(assignment);
  }

  async findByTeacher(teacherId: string, semesterId: string) {
    // In PostgreSQL, checking if an element exists in an array
    return this.cstRepository.createQueryBuilder('cst')
      .where('cst.semester_id = :semesterId', { semesterId })
      .andWhere(':teacherId = ANY(cst.teacher_ids)', { teacherId })
      .leftJoinAndSelect('cst.course', 'course')
      .leftJoinAndSelect('cst.section', 'section')
      .getMany();
  }

  async delete(id: string) {
    const assignment = await this.cstRepository.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.cstRepository.remove(assignment);
    return { success: true };
  }
}
