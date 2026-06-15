import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../entities/department.entity';
import { CreateDepartmentDto } from '../../dtos/department.dto';
import { UpdateDepartmentDto } from '../../dtos/update-dtos/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
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
    await this.departmentRepository.remove(department);
    return { success: true };
  }
}
