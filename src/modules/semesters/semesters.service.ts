import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Semester } from '../../entities/semester.entity';
import { CreateSemesterDto } from '../../dtos/semester.dto';
import { UpdateSemesterDto } from '../../dtos/update-dtos/update-semester.dto';

@Injectable()
export class SemestersService {
  constructor(
    @InjectRepository(Semester)
    private readonly semesterRepository: Repository<Semester>,
  ) {}

  async findAll() {
    return this.semesterRepository.find({ order: { year: 'DESC', season: 'DESC' } });
  }

  async findById(id: string) {
    const semester = await this.semesterRepository.findOne({ where: { id } });
    if (!semester) throw new NotFoundException(`Semester with ID ${id} not found`);
    return semester;
  }

  async findActive() {
    // Assuming the most recent one is active or we can add an is_active column
    return this.semesterRepository.findOne({ order: { year: 'DESC', season: 'DESC' } });
  }

  async create(dto: CreateSemesterDto) {
    const semester = this.semesterRepository.create(dto);
    return this.semesterRepository.save(semester);
  }

  async update(id: string, dto: UpdateSemesterDto) {
    const semester = await this.findById(id);
    Object.assign(semester, dto);
    return this.semesterRepository.save(semester);
  }

  async delete(id: string) {
    const semester = await this.findById(id);
    await this.semesterRepository.remove(semester);
    return { success: true };
  }
}
