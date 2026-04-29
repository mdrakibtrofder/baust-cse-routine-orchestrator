import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Day } from '../../entities/day.entity';

@Injectable()
export class DaysService {
  constructor(
    @InjectRepository(Day)
    private readonly dayRepository: Repository<Day>,
  ) {}

  async findAll() {
    return this.dayRepository.find({ order: { name: 'ASC' } });
  }

  async findById(id: string) {
    const day = await this.dayRepository.findOne({ where: { id } });
    if (!day) throw new NotFoundException(`Day with ID ${id} not found`);
    return day;
  }

  async create(name: string) {
    const day = this.dayRepository.create({ name });
    return this.dayRepository.save(day);
  }

  async delete(id: string) {
    const day = await this.findById(id);
    await this.dayRepository.remove(day);
    return { success: true };
  }
}
