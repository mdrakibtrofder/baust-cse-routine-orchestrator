import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Semester } from '../../entities/semester.entity';
import { CreateSemesterDto } from '../../dtos/semester/create-semester.dto';

@Injectable()
export class SemestersService {
  constructor(
    @InjectRepository(Semester)
    private readonly semesterRepository: Repository<Semester>,
  ) {}

  async findAll() {
    return this.semesterRepository.find({
      relations: ['year_ref', 'type_ref'],
      order: { year_ref: { value: 'DESC' }, created_at: 'DESC' },
    });
  }

  async findById(id: string) {
    const semester = await this.semesterRepository.findOne({
      where: { id },
      relations: ['year_ref', 'type_ref', 'classSlots', 'courseSectionTeachers'],
    });
    if (!semester) throw new NotFoundException(`Semester with ID ${id} not found`);
    return semester;
  }

  async findActive() {
    return this.semesterRepository.findOne({
      where: { is_active: true },
      relations: ['year_ref', 'type_ref'],
    }) || this.semesterRepository.findOne({
      relations: ['year_ref', 'type_ref'],
      order: { year_ref: { value: 'DESC' }, created_at: 'DESC' },
    });
  }

  async create(dto: CreateSemesterDto) {
    const existing = await this.semesterRepository.findOne({
      where: { year_id: dto.year_id, type_id: dto.type_id },
    });
    if (existing) throw new ConflictException('This semester combination already exists');

    if (dto.is_active) {
      await this.semesterRepository.update({ is_active: true }, { is_active: false });
    }

    const semester = this.semesterRepository.create(dto);
    return this.semesterRepository.save(semester);
  }

  async update(id: string, dto: Partial<CreateSemesterDto>) {
    const semester = await this.findById(id);

    if (dto.year_id && dto.type_id) {
      const existing = await this.semesterRepository.findOne({
        where: { year_id: dto.year_id, type_id: dto.type_id },
      });
      if (existing && existing.id !== id) throw new ConflictException('This semester combination already exists');
    }

    if (dto.is_active) {
      await this.semesterRepository.update({ is_active: true }, { is_active: false });
    }

    Object.assign(semester, dto);
    return this.semesterRepository.save(semester);
  }

  async delete(id: string) {
    const semester = await this.findById(id);
    if (
      (semester.classSlots && semester.classSlots.length > 0) ||
      (semester.courseSectionTeachers && semester.courseSectionTeachers.length > 0)
    ) {
      throw new BadRequestException('Cannot delete a semester that has active routines or assignments');
    }
    await this.semesterRepository.remove(semester);
    return { success: true };
  }
}
