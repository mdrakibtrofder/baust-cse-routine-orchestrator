import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomUnavailability } from '../../entities/room-unavailability.entity';
import { CreateRoomUnavailabilityDto, UpdateRoomUnavailabilityDto } from '../../dtos/unavailability.dto';

@Injectable()
export class RoomUnavailabilityService {
  constructor(
    @InjectRepository(RoomUnavailability)
    private readonly repository: Repository<RoomUnavailability>,
  ) {}

  async findAll() {
    return this.repository.find({ relations: ['room'] });
  }

  async findByRoom(roomId: string) {
    return this.repository.find({
      where: { room_id: roomId },
      relations: ['room'],
    });
  }

  async create(dto: CreateRoomUnavailabilityDto) {
    // Check for duplicates
    const existing = await this.repository.findOne({
      where: {
        room_id: dto.room_id,
        days: dto.days as any, // Simple exact match for array
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

  async update(id: string, dto: UpdateRoomUnavailabilityDto) {
    const unavail = await this.repository.findOne({ where: { id } });
    if (!unavail) throw new NotFoundException('Unavailability not found');

    // Check for duplicates if time/days changed
    if (dto.days || dto.start || dto.end) {
      const checkDays = dto.days || unavail.days;
      const checkStart = dto.start || unavail.start;
      const checkEnd = dto.end || unavail.end;

      const existing = await this.repository.findOne({
        where: {
          room_id: unavail.room_id,
          days: checkDays as any,
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
