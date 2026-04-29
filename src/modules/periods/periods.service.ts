import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Period } from '../../entities/period.entity';
import { CreatePeriodDto } from '../../dtos/period.dto';
import { UpdatePeriodDto } from '../../dtos/update-dtos/update-period.dto';

@Injectable()
export class PeriodsService {
  constructor(
    @InjectRepository(Period)
    private readonly periodRepository: Repository<Period>,
  ) {}

  async findAll(kind?: 'theory' | 'sessional') {
    const where: any = {};
    if (kind) where.kind = kind;
    return this.periodRepository.find({ where, order: { start: 'ASC' } });
  }

  async findById(id: string) {
    const period = await this.periodRepository.findOne({ where: { id } });
    if (!period) throw new NotFoundException(`Period with ID ${id} not found`);
    return period;
  }

  async create(dto: CreatePeriodDto) {
    const period = this.periodRepository.create(dto);
    return this.periodRepository.save(period);
  }

  async update(id: string, dto: UpdatePeriodDto) {
    const period = await this.findById(id);
    Object.assign(period, dto);
    return this.periodRepository.save(period);
  }

  async delete(id: string) {
    const period = await this.findById(id);
    await this.periodRepository.remove(period);
    return { success: true };
  }
}
