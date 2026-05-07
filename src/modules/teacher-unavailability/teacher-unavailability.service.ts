import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherUnavailability } from '../../entities/teacher-unavailability.entity';
import { CreateTeacherUnavailabilityDto, UpdateTeacherUnavailabilityDto } from '../../dtos/unavailability.dto';

@Injectable()
export class TeacherUnavailabilityService {
  constructor(
    @InjectRepository(TeacherUnavailability)
    private readonly repository: Repository<TeacherUnavailability>,
  ) {}

  async findAll() {
    return this.repository.find({ relations: ['teacher'] });
  }

  async findByTeacher(teacherId: string) {
    return this.repository.find({
      where: { teacher_id: teacherId },
      relations: ['teacher'],
    });
  }

  async create(dto: CreateTeacherUnavailabilityDto) {
    // Check for duplicates
    const existing = await this.repository.findOne({
      where: {
        teacher_id: dto.teacher_id,
        day: dto.day,
        start: dto.start,
        end: dto.end,
      },
    });

    if (existing) {
      throw new ConflictException('Unavailability for this time already exists');
    }

    const unavail = this.repository.create(dto);
    return this.repository.save(unavail);
  }

  async update(id: string, dto: UpdateTeacherUnavailabilityDto) {
    const unavail = await this.repository.findOne({ where: { id } });
    if (!unavail) throw new NotFoundException('Unavailability not found');

    // Check for duplicates if time/day changed
    if (dto.day || dto.start || dto.end) {
      const checkDay = dto.day || unavail.day;
      const checkStart = dto.start || unavail.start;
      const checkEnd = dto.end || unavail.end;

      const existing = await this.repository.findOne({
        where: {
          teacher_id: unavail.teacher_id,
          day: checkDay,
          start: checkStart,
          end: checkEnd,
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Unavailability for this time already exists');
      }
    }

    Object.assign(unavail, dto);
    return this.repository.save(unavail);
  }

  async delete(id: string) {
    const unavail = await this.repository.findOne({ where: { id } });
    if (!unavail) throw new NotFoundException('Unavailability not found');
    await this.repository.remove(unavail);
    return { success: true };
  }
}
