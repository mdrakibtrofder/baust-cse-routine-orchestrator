import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Section } from '../../entities/section.entity';
import { CreateSectionDto } from '../../dtos/section.dto';
import { UpdateSectionDto } from '../../dtos/update-dtos/update-section.dto';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
  ) {}

  async findAll(level?: number, term?: 'I' | 'II') {
    const where: any = {};
    if (level) where.level = level;
    if (term) where.term = term;
    return this.sectionRepository.find({ where, order: { level: 'ASC', term: 'ASC', name: 'ASC' } });
  }

  async findById(id: string) {
    const section = await this.sectionRepository.findOne({ where: { id } });
    if (!section) throw new NotFoundException(`Section with ID ${id} not found`);
    return section;
  }

  async create(dto: CreateSectionDto) {
    const section = this.sectionRepository.create(dto);
    return this.sectionRepository.save(section);
  }

  async update(id: string, dto: UpdateSectionDto) {
    const section = await this.findById(id);
    Object.assign(section, dto);
    return this.sectionRepository.save(section);
  }

  async delete(id: string) {
    const section = await this.findById(id);
    await this.sectionRepository.remove(section);
    return { success: true };
  }
}
