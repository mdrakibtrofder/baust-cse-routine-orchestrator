import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriorityClass } from '../../entities/priority-class.entity';
import { CreatePriorityClassDto } from '../../dtos/priority-class.dto';
import { UpdatePriorityClassDto } from '../../dtos/update-priority-class.dto';

@Injectable()
export class PriorityClassesService {
  constructor(
    @InjectRepository(PriorityClass)
    private readonly priorityClassRepository: Repository<PriorityClass>,
  ) {}

  async findAll(semesterId?: string) {
    if (semesterId) {
      return this.priorityClassRepository.find({
        where: { semester_id: semesterId },
        relations: ['semester', 'department', 'section'],
        order: { created_at: 'DESC' },
      });
    }
    return this.priorityClassRepository.find({
      relations: ['semester', 'department', 'section'],
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string) {
    const entry = await this.priorityClassRepository.findOne({
      where: { id },
      relations: ['semester', 'department', 'section'],
    });
    if (!entry) throw new NotFoundException(`Priority Class with ID ${id} not found`);
    return entry;
  }

  async create(dto: CreatePriorityClassDto) {
    const entry = this.priorityClassRepository.create(dto);
    await this.priorityClassRepository.save(entry);
    return this.findById(entry.id);
  }

  async update(id: string, dto: UpdatePriorityClassDto) {
    const res = await this.priorityClassRepository.update(id, dto);
    if (res.affected === 0) throw new NotFoundException(`Priority Class with ID ${id} not found`);
    return this.findById(id);
  }

  async delete(id: string) {
    const entry = await this.findById(id);
    await this.priorityClassRepository.remove(entry);
    return { success: true };
  }
}
