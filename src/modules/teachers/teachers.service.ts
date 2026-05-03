import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from '../../entities/teacher.entity';
import { CreateTeacherDto } from '../../dtos/teacher.dto';
import { UpdateTeacherDto } from '../../dtos/update-teacher.dto';

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher)
    private readonly teacherRepository: Repository<Teacher>,
  ) {}

  async findAll(page = 1, limit = 20, search?: string) {
    const query = this.teacherRepository.createQueryBuilder('teacher');

    if (search) {
      query.where('teacher.name ILIKE :search', { search: `%${search}%` })
        .orWhere('teacher.short_name ILIKE :search', { search: `%${search}%` });
    }

    const [data, total] = await query
      .orderBy('teacher.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Teacher> {
    const teacher = await this.teacherRepository.findOne({ where: { id } });
    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }
    return teacher;
  }

  async findByShortName(shortName: string): Promise<Teacher> {
    const teacher = await this.teacherRepository.findOne({ where: { short_name: shortName } });
    if (!teacher) {
      throw new NotFoundException(`Teacher with short name ${shortName} not found`);
    }
    return teacher;
  }

  async create(dto: CreateTeacherDto): Promise<Teacher> {
    const existing = await this.teacherRepository.findOne({
      where: { short_name: dto.short_name },
    });

    if (existing) {
      throw new ConflictException(`Teacher with short_name "${dto.short_name}" already exists`);
    }

    const teacher = this.teacherRepository.create({
      ...dto,
      assigned_credit_hours: dto.assigned_credit_hours || 0,
      status: dto.status || '',
    });

    return this.teacherRepository.save(teacher);
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<Teacher> {
    const teacher = await this.findById(id);

    if (dto.short_name && dto.short_name !== teacher.short_name) {
      const existing = await this.teacherRepository.findOne({
        where: { short_name: dto.short_name },
      });
      if (existing) {
        throw new ConflictException(`Teacher with short_name "${dto.short_name}" already exists`);
      }
    }

    Object.assign(teacher, dto);
    return this.teacherRepository.save(teacher);
  }

  async delete(id: string): Promise<void> {
    const teacher = await this.findById(id);
    await this.teacherRepository.remove(teacher);
  }

  async bulkImport(teachers: CreateTeacherDto[]): Promise<Teacher[]> {
    const shortNames = new Set(teachers.map(t => t.short_name));
    
    if (shortNames.size !== teachers.length) {
      throw new BadRequestException('Duplicate short_name in import data');
    }

    const existing = await this.teacherRepository.find({
      where: { short_name: Array.from(shortNames) as any }, // Using 'as any' for shortNames set
    });

    if (existing.length > 0) {
      throw new ConflictException(
        `Teachers with short_names already exist: ${existing.map(t => t.short_name).join(', ')}`
      );
    }

    const entities = teachers.map(dto =>
      this.teacherRepository.create({
        ...dto,
        assigned_credit_hours: dto.assigned_credit_hours || 0,
        status: dto.status || '',
      })
    );

    return this.teacherRepository.save(entities);
  }

  async getTeacherLoad(teacherId: string): Promise<{ teacher: Teacher; totalCredit: number }> {
    const teacher = await this.findById(teacherId);
    return {
      teacher,
      totalCredit: Number(teacher.assigned_credit_hours),
    };
  }
}
