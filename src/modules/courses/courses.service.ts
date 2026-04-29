import { Injectable, NotFoundException } from '@nestjs/common';
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

  async findAll(level?: number, term?: 'I' | 'II') {
    const where: any = {};
    if (level) where.level = level;
    if (term) where.term = term;
    return this.courseRepository.find({ where, order: { level: 'ASC', term: 'ASC', code: 'ASC' } });
  }

  async findById(id: string) {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) throw new NotFoundException(`Course with ID ${id} not found`);
    return course;
  }

  async create(dto: CreateCourseDto) {
    const course = this.courseRepository.create(dto);
    return this.courseRepository.save(course);
  }

  async update(id: string, dto: UpdateCourseDto) {
    const course = await this.findById(id);
    Object.assign(course, dto);
    return this.courseRepository.save(course);
  }

  async delete(id: string) {
    const course = await this.findById(id);
    await this.courseRepository.remove(course);
    return { success: true };
  }
}
