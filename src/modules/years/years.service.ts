import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Year } from '../../entities/year.entity';
import { CreateYearDto } from '../../dtos/year/create-year.dto';

@Injectable()
export class YearsService {
  constructor(
    @InjectRepository(Year)
    private readonly yearRepository: Repository<Year>,
  ) {}

  async findAll() {
    return this.yearRepository.find({ order: { value: 'ASC' } });
  }

  async findOne(id: string) {
    const year = await this.yearRepository.findOne({ where: { id }, relations: ['semesters'] });
    if (!year) throw new NotFoundException(`Year with ID ${id} not found`);
    return year;
  }

  async create(dto: CreateYearDto) {
    const existing = await this.yearRepository.findOne({ where: { value: dto.value } });
    if (existing) throw new ConflictException(`Year ${dto.value} already exists`);
    const year = this.yearRepository.create(dto);
    return this.yearRepository.save(year);
  }

  async update(id: string, dto: CreateYearDto) {
    const year = await this.findOne(id);
    if (year.semesters && year.semesters.length > 0) {
      throw new BadRequestException('Cannot edit a year that is already in use by semesters');
    }
    const existing = await this.yearRepository.findOne({ where: { value: dto.value } });
    if (existing && existing.id !== id) throw new ConflictException(`Year ${dto.value} already exists`);
    
    Object.assign(year, dto);
    return this.yearRepository.save(year);
  }

  async delete(id: string) {
    const year = await this.findOne(id);
    if (year.semesters && year.semesters.length > 0) {
      throw new BadRequestException('Cannot delete a year that is already in use by semesters');
    }
    await this.yearRepository.remove(year);
    return { success: true };
  }
}
