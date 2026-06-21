import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../../entities/course.entity';
import { CreateCourseDto } from '../../dtos/course.dto';
import { UpdateCourseDto } from '../../dtos/update-dtos/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
  ) {}

  /** Same code is only a clash within the same level/term/departmental_type/department.
   *  Courses in different departments may freely reuse the same code. */
  private async assertNoDuplicate(
    code: string,
    level: number,
    term: 'I' | 'II',
    departmental_type: 'Departmental' | 'Non-Departmental',
    department_id: string | null | undefined,
    ignoreId?: string,
  ) {
    const existing = await this.courseRepository
      .createQueryBuilder('course')
      .where('LOWER(course.code) = LOWER(:code)', { code })
      .andWhere('course.level = :level', { level })
      .andWhere('course.term = :term', { term })
      .andWhere('course.departmental_type = :departmental_type', { departmental_type })
      .andWhere(
        department_id ? 'course.department_id = :department_id' : 'course.department_id IS NULL',
        department_id ? { department_id } : {},
      )
      .andWhere(ignoreId ? 'course.id != :ignoreId' : '1=1', ignoreId ? { ignoreId } : {})
      .getOne();

    if (existing) {
      throw new ConflictException(
        `Course code "${code}" already exists for Level ${level} Term ${term} in this department.`,
      );
    }
  }

  async findAll(level?: number, term?: 'I' | 'II') {
    const where: any = {};
    if (level) where.level = level;
    if (term) where.term = term;
    return this.courseRepository.find({ 
      where, 
      order: { 
        departmental_type: 'ASC', // 'Departmental' comes before 'Non-Departmental' alphabetically
        level: 'ASC', 
        term: 'ASC', 
        code: 'ASC' 
      } 
    });
  }

  async findById(id: string) {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) throw new NotFoundException(`Course with ID ${id} not found`);
    return course;
  }

  async create(dto: CreateCourseDto) {
    await this.assertNoDuplicate(dto.code, dto.level, dto.term, dto.departmental_type, dto.department_id);
    const course = this.courseRepository.create(dto);
    return this.courseRepository.save(course);
  }

  async update(id: string, dto: UpdateCourseDto) {
    const current = await this.findById(id);
    await this.assertNoDuplicate(
      dto.code ?? current.code,
      dto.level ?? current.level,
      dto.term ?? current.term,
      dto.departmental_type ?? current.departmental_type,
      dto.department_id !== undefined ? dto.department_id : current.department_id,
      id,
    );
    const res = await this.courseRepository.update(id, dto);
    if (res.affected === 0) throw new NotFoundException(`Course with ID ${id} not found`);
    return this.findById(id);
  }

  async delete(id: string) {
    const course = await this.findById(id);
    await this.courseRepository.remove(course);
    return { success: true };
  }
}
