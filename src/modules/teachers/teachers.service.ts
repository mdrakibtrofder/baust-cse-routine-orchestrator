import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Teacher } from '../../entities/teacher.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { TeacherUnavailability } from '../../entities/teacher-unavailability.entity';
import { CreateTeacherDto } from '../../dtos/teacher.dto';
import { UpdateTeacherDto } from '../../dtos/update-teacher.dto';

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher)
    private readonly teacherRepository: Repository<Teacher>,
    @InjectRepository(CourseSectionTeacher)
    private readonly cstRepository: Repository<CourseSectionTeacher>,
    @InjectRepository(TeacherUnavailability)
    private readonly unavailabilityRepository: Repository<TeacherUnavailability>,
    private readonly dataSource: DataSource,
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

    return await this.dataSource.transaction(async (manager) => {
      Object.assign(teacher, dto);
      return await manager.save(teacher);
    });
  }

  async delete(id: string): Promise<void> {
    const teacher = await this.findById(id);

    // Check for course assignments (CourseSectionTeacher)
    // Since teacher_ids is an array of UUIDs in CourseSectionTeacher
    const assignments = await this.cstRepository.createQueryBuilder('cst')
      .where(':id = ANY(cst.teacher_ids)', { id })
      .getMany();

    if (assignments.length > 0) {
      throw new ConflictException({
        message: 'Cannot delete teacher with existing course assignments',
        code: 'TEACHER_HAS_ASSIGNMENTS',
        assignmentsCount: assignments.length,
      });
    }

    // Check for unavailability rules
    const unavailability = await this.unavailabilityRepository.find({
      where: { teacher_id: id },
    });

    return await this.dataSource.transaction(async (manager) => {
      // If we decide to cascade delete unavailability, we do it here. 
      // Or we block if unavailability exists. Let's block to be safe, or just delete them.
      // Usually unavailability is tied strictly to the teacher, so deleting it is fine.
      if (unavailability.length > 0) {
        await manager.remove(unavailability);
      }
      
      await manager.remove(teacher);
    });
  }

  async bulkImport(teachers: CreateTeacherDto[]): Promise<Teacher[]> {
    const shortNames = new Set(teachers.map(t => t.short_name));
    
    if (shortNames.size !== teachers.length) {
      throw new BadRequestException('Duplicate short_name in import data');
    }

    const existing = await this.teacherRepository.find({
      where: { short_name: Array.from(shortNames) as any },
    });

    if (existing.length > 0) {
      throw new ConflictException(
        `Teachers with short_names already exist: ${existing.map(t => t.short_name).join(', ')}`
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      const entities = teachers.map(dto =>
        manager.create(Teacher, {
          ...dto,
          assigned_credit_hours: dto.assigned_credit_hours || 0,
          status: dto.status || '',
        })
      );
      return await manager.save(entities);
    });
  }

  async getTeacherLoad(teacherId: string): Promise<{ teacher: Teacher; totalCredit: number }> {
    const teacher = await this.findById(teacherId);
    return {
      teacher,
      totalCredit: Number(teacher.assigned_credit_hours),
    };
  }

  async moveAssignments(fromTeacherId: string, toTeacherId: string): Promise<void> {
    const fromTeacher = await this.findById(fromTeacherId);
    const toTeacher = await this.findById(toTeacherId);

    if (fromTeacherId === toTeacherId) {
      throw new BadRequestException('Cannot move assignments to the same teacher');
    }

    // Find all assignments for fromTeacher
    const assignments = await this.cstRepository.createQueryBuilder('cst')
      .where(':id = ANY(cst.teacher_ids)', { id: fromTeacherId })
      .getMany();

    if (assignments.length === 0) {
      return;
    }

    return await this.dataSource.transaction(async (manager) => {
      for (const assignment of assignments) {
        // Replace fromTeacherId with toTeacherId in teacher_ids array
        assignment.teacher_ids = assignment.teacher_ids.map(id => 
          id === fromTeacherId ? toTeacherId : id
        );
        await manager.save(assignment);
      }
    });
  }
}
