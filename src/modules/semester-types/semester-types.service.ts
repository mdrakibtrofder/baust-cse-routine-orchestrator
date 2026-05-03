import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SemesterType } from '../../entities/semester-type.entity';
import { CreateSemesterTypeDto } from '../../dtos/semester-type/create-semester-type.dto';

@Injectable()
export class SemesterTypesService {
  constructor(
    @InjectRepository(SemesterType)
    private readonly typeRepository: Repository<SemesterType>,
  ) {}

  async findAll() {
    return this.typeRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const type = await this.typeRepository.findOne({ where: { id }, relations: ['semesters'] });
    if (!type) throw new NotFoundException(`Semester type with ID ${id} not found`);
    return type;
  }

  async create(dto: CreateSemesterTypeDto) {
    const existing = await this.typeRepository.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Semester type "${dto.name}" already exists`);
    const type = this.typeRepository.create(dto);
    return this.typeRepository.save(type);
  }

  async update(id: string, dto: CreateSemesterTypeDto) {
    const type = await this.findOne(id);
    if (type.semesters && type.semesters.length > 0) {
      throw new BadRequestException('Cannot edit a semester type that is already in use');
    }
    const existing = await this.typeRepository.findOne({ where: { name: dto.name } });
    if (existing && existing.id !== id) throw new ConflictException(`Semester type "${dto.name}" already exists`);
    
    Object.assign(type, dto);
    return this.typeRepository.save(type);
  }

  async delete(id: string) {
    const type = await this.findOne(id);
    if (type.semesters && type.semesters.length > 0) {
      throw new BadRequestException('Cannot delete a semester type that is already in use');
    }
    await this.typeRepository.remove(type);
    return { success: true };
  }
}
