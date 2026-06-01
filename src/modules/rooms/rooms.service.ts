import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../../entities/room.entity';
import { CreateRoomDto } from '../../dtos/room.dto';
import { UpdateRoomDto } from '../../dtos/update-dtos/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async findAll() {
    return this.roomRepository.find({ order: { name: 'ASC' } });
  }

  async findById(id: string) {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException(`Room with ID ${id} not found`);
    return room;
  }

  async create(dto: CreateRoomDto) {
    const room = this.roomRepository.create(dto);
    return this.roomRepository.save(room);
  }

  async update(id: string, dto: UpdateRoomDto) {
    const res = await this.roomRepository.update(id, dto);
    if (res.affected === 0) throw new NotFoundException(`Room with ID ${id} not found`);
    return this.findById(id);
  }

  async delete(id: string) {
    const room = await this.findById(id);
    await this.roomRepository.remove(room);
    return { success: true };
  }
}
