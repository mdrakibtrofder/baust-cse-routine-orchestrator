import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../entities/department.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { CreateDepartmentDto } from '../../dtos/department.dto';
import { UpdateDepartmentDto } from '../../dtos/update-dtos/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async findAll() {
    return this.departmentRepository.find({ order: { short_name: 'ASC' } });
  }

  async findById(id: string) {
    const department = await this.departmentRepository.findOne({ where: { id } });
    if (!department) throw new NotFoundException(`Department with ID ${id} not found`);
    return department;
  }

  async create(dto: CreateDepartmentDto) {
    const department = this.departmentRepository.create(dto);
    return this.departmentRepository.save(department);
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const res = await this.departmentRepository.update(id, dto);
    if (res.affected === 0) throw new NotFoundException(`Department with ID ${id} not found`);
    return this.findById(id);
  }

  async delete(id: string) {
    const department = await this.findById(id);

    const [courseCount, sectionCount, roomCount] = await Promise.all([
      this.courseRepository.count({ where: { department_id: id } }),
      this.sectionRepository.count({ where: { department_id: id } }),
      this.roomRepository.count({ where: { department_id: id } }),
    ]);

    if (courseCount > 0 || sectionCount > 0 || roomCount > 0) {
      throw new ConflictException(
        `Cannot delete department "${department.short_name}": ${courseCount} course(s), ${sectionCount} section(s), and ${roomCount} room(s) still reference it. Reassign or remove them first.`,
      );
    }

    await this.departmentRepository.remove(department);
    return { success: true };
  }
}
