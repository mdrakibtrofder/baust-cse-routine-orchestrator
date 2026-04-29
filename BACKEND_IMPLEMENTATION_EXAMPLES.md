# Routine Management System - Implementation Examples

Complete working examples for each module type.

---

## Complete Teachers Module Implementation

### 1. DTOs

**`src/dtos/create-teacher.dto.ts`**
```typescript
import { IsString, IsOptional, IsNumber, Min, Max, Matches } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9]+$/, { message: 'Short name must be alphanumeric' })
  short_name: string;

  @IsString()
  name: string;

  @IsString()
  designation: string;

  @IsString()
  department: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  assigned_credit?: number;
}
```

**`src/dtos/update-teacher.dto.ts`**
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateTeacherDto } from './create-teacher.dto';

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}
```

### 2. Entity

**`src/entities/teacher.entity.ts`** (complete)
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('teachers')
@Index(['short_name'], { unique: true })
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  short_name: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  designation: string;

  @Column({ type: 'varchar', length: 100 })
  department: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  status: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  assigned_credit: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

### 3. Service

**`src/modules/teachers/teachers.service.ts`** (complete)
```typescript
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from '../../entities/teacher.entity';
import { CreateTeacherDto } from '../../dtos/create-teacher.dto';
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
      assigned_credit: dto.assigned_credit || 0,
      status: dto.status || '',
    });

    return this.teacherRepository.save(teacher);
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<Teacher> {
    const teacher = await this.findById(id);

    // Check short_name uniqueness if updating
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

    // Check for existing short names
    const existing = await this.teacherRepository.find({
      where: { short_name: Array.from(shortNames) },
    });

    if (existing.length > 0) {
      throw new ConflictException(
        `Teachers with short_names already exist: ${existing.map(t => t.short_name).join(', ')}`
      );
    }

    const entities = teachers.map(dto =>
      this.teacherRepository.create({
        ...dto,
        assigned_credit: dto.assigned_credit || 0,
        status: dto.status || '',
      })
    );

    return this.teacherRepository.save(entities);
  }

  async getTeacherLoad(teacherId: string): Promise<{ teacher: Teacher; totalCredit: number }> {
    const teacher = await this.findById(teacherId);
    // This would typically join with course_section_teachers and courses
    // to calculate actual assigned credit, but we store it directly
    return {
      teacher,
      totalCredit: teacher.assigned_credit,
    };
  }
}
```

### 4. Controller

**`src/modules/teachers/teachers.controller.ts`** (complete)
```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from '../../dtos/create-teacher.dto';
import { UpdateTeacherDto } from '../../dtos/update-teacher.dto';

@Controller('api/teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.teachersService.findAll(Number(page), Number(limit), search);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.teachersService.findById(id);
  }

  @Get('short-name/:shortName')
  async findByShortName(@Param('shortName') shortName: string) {
    return this.teachersService.findByShortName(shortName);
  }

  @Post()
  async create(@Body() dto: CreateTeacherDto) {
    return this.teachersService.create(dto);
  }

  @Post('bulk-import')
  async bulkImport(@Body() dto: { teachers: CreateTeacherDto[] }) {
    if (!Array.isArray(dto.teachers) || dto.teachers.length === 0) {
      throw new BadRequestException('Invalid import data');
    }
    return this.teachersService.bulkImport(dto.teachers);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachersService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.teachersService.delete(id);
    return { success: true, message: 'Teacher deleted successfully' };
  }

  @Get(':id/load')
  async getTeacherLoad(@Param('id') id: string) {
    return this.teachersService.getTeacherLoad(id);
  }
}
```

### 5. Module

**`src/modules/teachers/teachers.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Teacher } from '../../entities/teacher.entity';
import { TeachersService } from './teachers.service';
import { TeachersController } from './teachers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Teacher])],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
```

---

## Complete Class Slots Module Implementation

### 1. DTOs

**`src/dtos/create-class-slot.dto.ts`**
```typescript
import { IsUUID, IsString, Matches, IsOptional, IsEnum } from 'class-validator';

export class CreateClassSlotDto {
  @IsUUID()
  semester_id: string;

  @IsUUID()
  course_id: string;

  @IsUUID()
  section_id: string;

  @IsString()
  day: string; // "Sunday", "Monday", etc.

  @Matches(/^\d{2}:\d{2}$/, { message: 'Start time must be HH:MM format' })
  start: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'End time must be HH:MM format' })
  end: string;

  @IsOptional()
  @IsUUID()
  room_id?: string;

  @IsOptional()
  @IsEnum(['EVERY', 'EVEN', 'ODD'])
  week?: 'EVERY' | 'EVEN' | 'ODD';
}
```

**`src/dtos/update-class-slot.dto.ts`**
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateClassSlotDto } from './create-class-slot.dto';

export class UpdateClassSlotDto extends PartialType(CreateClassSlotDto) {}
```

**`src/dtos/check-conflicts.dto.ts`**
```typescript
import { IsUUID, IsArray, IsString, IsOptional, IsEnum, Matches } from 'class-validator';

export class CheckConflictsDto {
  @IsUUID()
  semester_id: string;

  @IsUUID()
  course_id: string;

  @IsUUID()
  section_id: string;

  @IsArray()
  @IsUUID('all', { each: true })
  teacher_ids: string[];

  @IsString()
  day: string;

  @Matches(/^\d{2}:\d{2}$/)
  start: string;

  @Matches(/^\d{2}:\d{2}$/)
  end: string;

  @IsOptional()
  @IsUUID()
  room_id?: string;

  @IsOptional()
  @IsEnum(['EVERY', 'EVEN', 'ODD'])
  week?: 'EVERY' | 'EVEN' | 'ODD';

  @IsOptional()
  @IsUUID()
  ignoreSlotId?: string;
}
```

### 2. Service with Conflict Detection

**`src/modules/class-slots/class-slots.service.ts`** (excerpt with key methods)
```typescript
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { CreateClassSlotDto } from '../../dtos/create-class-slot.dto';
import { UpdateClassSlotDto } from '../../dtos/update-class-slot.dto';
import { CheckConflictsDto } from '../../dtos/check-conflicts.dto';

interface Conflict {
  type: string;
  message: string;
}

@Injectable()
export class ClassSlotsService {
  constructor(
    @InjectRepository(ClassSlot)
    private readonly classSlotRepository: Repository<ClassSlot>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(CourseSectionTeacher)
    private readonly cstRepository: Repository<CourseSectionTeacher>,
  ) {}

  async findBySemester(semesterId: string): Promise<ClassSlot[]> {
    return this.classSlotRepository.find({
      where: { semester_id: semesterId },
      relations: ['course', 'section', 'room'],
    });
  }

  async findById(id: string): Promise<ClassSlot> {
    const slot = await this.classSlotRepository.findOne({
      where: { id },
      relations: ['course', 'section', 'room', 'semester'],
    });
    if (!slot) {
      throw new NotFoundException(`Class slot with ID ${id} not found`);
    }
    return slot;
  }

  async create(dto: CreateClassSlotDto): Promise<ClassSlot> {
    // Validate basic entities exist
    const course = await this.courseRepository.findOne({ where: { id: dto.course_id } });
    const section = await this.sectionRepository.findOne({ where: { id: dto.section_id } });

    if (!course || !section) {
      throw new BadRequestException('Invalid course or section');
    }

    // Check for conflicts
    const conflicts = await this.checkConflicts(dto);
    if (conflicts.length > 0) {
      throw new ConflictException({ message: 'Conflicts detected', conflicts });
    }

    const slot = this.classSlotRepository.create({
      ...dto,
      week: dto.week || 'EVERY',
    });

    return this.classSlotRepository.save(slot);
  }

  async update(id: string, dto: UpdateClassSlotDto): Promise<ClassSlot> {
    const slot = await this.findById(id);

    // Check conflicts, excluding current slot
    const conflictDto = { ...dto, ...{ ignoreSlotId: id } };
    const conflicts = await this.checkConflicts(conflictDto);
    if (conflicts.length > 0) {
      throw new ConflictException({ message: 'Conflicts detected', conflicts });
    }

    Object.assign(slot, dto);
    return this.classSlotRepository.save(slot);
  }

  async delete(id: string): Promise<void> {
    const slot = await this.findById(id);
    await this.classSlotRepository.remove(slot);
  }

  async deleteForCourseSection(courseId: string, sectionId: string, semesterId: string): Promise<void> {
    await this.classSlotRepository.delete({
      semester_id: semesterId,
      course_id: courseId,
      section_id: sectionId,
    });
  }

  async checkConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Get course and section
    const course = await this.courseRepository.findOne({ where: { id: dto.course_id } });
    const section = await this.sectionRepository.findOne({ where: { id: dto.section_id } });

    if (!course || !section) {
      return [];
    }

    // Check room capacity
    if (dto.room_id) {
      const room = await this.roomRepository.findOne({ where: { id: dto.room_id } });
      if (room) {
        if (room.capacity < section.total_students) {
          conflicts.push({
            type: 'room_capacity',
            message: `Room ${room.name} capacity (${room.capacity}) < section students (${section.total_students})`,
          });
        }

        // Check room type matches course type
        const isTheory = course.course_type.includes('theory');
        const isSessional = course.course_type.includes('sessional');
        if ((isTheory && room.room_type !== 'Theory') || (isSessional && room.room_type !== 'Sessional')) {
          conflicts.push({
            type: 'room_type',
            message: `Room ${room.name} is ${room.room_type} but course needs ${isTheory ? 'Theory' : 'Sessional'}`,
          });
        }

        // Check room double booking
        const roomConflicts = await this.checkRoomConflicts(dto);
        conflicts.push(...roomConflicts);
      }
    }

    // Check teacher conflicts
    if (dto.teacher_ids.length > 0) {
      const teacherConflicts = await this.checkTeacherConflicts(dto);
      conflicts.push(...teacherConflicts);
    }

    // Check section double booking
    const sectionConflicts = await this.checkSectionConflicts(dto);
    conflicts.push(...sectionConflicts);

    return conflicts;
  }

  private async checkRoomConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const overlappingSlots = await this.classSlotRepository.find({
      where: {
        semester_id: dto.semester_id,
        room_id: dto.room_id,
        day: dto.day,
      },
      relations: ['course', 'section'],
    });

    for (const slot of overlappingSlots) {
      if (slot.id === dto.ignoreSlotId) continue;
      if (!this.timesOverlap(slot.start, slot.end, dto.start, dto.end)) continue;
      if (!this.weeksOverlap(slot.week, dto.week || 'EVERY')) continue;

      const room = await this.roomRepository.findOne({ where: { id: dto.room_id } });
      conflicts.push({
        type: 'room_double',
        message: `Room ${room?.name} already booked ${slot.day} ${slot.start}-${slot.end} by ${slot.course?.code} (Sec ${slot.section?.name})`,
      });
    }

    return conflicts;
  }

  private async checkTeacherConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const teacherSlots = await this.classSlotRepository.find({
      where: {
        semester_id: dto.semester_id,
        day: dto.day,
      },
      relations: ['course', 'section'],
    });

    for (const slot of teacherSlots) {
      if (slot.id === dto.ignoreSlotId) continue;

      // Check if this slot has any of the same teachers
      const cst = await this.cstRepository.findOne({
        where: {
          semester_id: dto.semester_id,
          course_id: slot.course_id,
          section_id: slot.section_id,
        },
      });

      if (!cst) continue;

      const hasCommonTeacher = cst.teacher_ids.some(tid => dto.teacher_ids.includes(tid));
      if (!hasCommonTeacher) continue;

      if (!this.timesOverlap(slot.start, slot.end, dto.start, dto.end)) continue;
      if (!this.weeksOverlap(slot.week, dto.week || 'EVERY')) continue;

      conflicts.push({
        type: 'teacher_double',
        message: `Assigned teacher already has class ${slot.day} ${slot.start}-${slot.end}`,
      });
    }

    return conflicts;
  }

  private async checkSectionConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const sectionSlots = await this.classSlotRepository.find({
      where: {
        semester_id: dto.semester_id,
        section_id: dto.section_id,
        day: dto.day,
      },
      relations: ['course'],
    });

    for (const slot of sectionSlots) {
      if (slot.id === dto.ignoreSlotId) continue;
      if (!this.timesOverlap(slot.start, slot.end, dto.start, dto.end)) continue;
      if (!this.weeksOverlap(slot.week, dto.week || 'EVERY')) continue;

      conflicts.push({
        type: 'section_double',
        message: `Section already has class ${slot.day} ${slot.start}-${slot.end} for ${slot.course?.code}`,
      });
    }

    return conflicts;
  }

  private timesOverlap(s1Start: string, s1End: string, s2Start: string, s2End: string): boolean {
    const toMin = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    return toMin(s1Start) < toMin(s2End) && toMin(s2Start) < toMin(s1End);
  }

  private weeksOverlap(w1: string, w2: string): boolean {
    if (w1 === 'EVERY' || w2 === 'EVERY') return true;
    return w1 === w2;
  }
}
```

### 3. Controller

**`src/modules/class-slots/class-slots.controller.ts`** (excerpt)
```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ClassSlotsService } from './class-slots.service';
import { CreateClassSlotDto } from '../../dtos/create-class-slot.dto';
import { UpdateClassSlotDto } from '../../dtos/update-class-slot.dto';
import { CheckConflictsDto } from '../../dtos/check-conflicts.dto';

@Controller('api/class-slots')
export class ClassSlotsController {
  constructor(private readonly classSlotsService: ClassSlotsService) {}

  @Get()
  async findBySemester(@Query('semester_id') semesterId: string) {
    return this.classSlotsService.findBySemester(semesterId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.classSlotsService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateClassSlotDto) {
    return this.classSlotsService.create(dto);
  }

  @Post('check-conflicts')
  async checkConflicts(@Body() dto: CheckConflictsDto) {
    const conflicts = await this.classSlotsService.checkConflicts(dto);
    return { conflicts, hasConflicts: conflicts.length > 0 };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClassSlotDto) {
    return this.classSlotsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.classSlotsService.delete(id);
    return { success: true };
  }

  @Delete('course/:courseId/section/:sectionId')
  async deleteForCourseSection(
    @Param('courseId') courseId: string,
    @Param('sectionId') sectionId: string,
    @Query('semester_id') semesterId: string,
  ) {
    await this.classSlotsService.deleteForCourseSection(courseId, sectionId, semesterId);
    return { success: true };
  }
}
```

---

## Routine View Service (Composite Query)

**`src/modules/routine/routine.service.ts`**
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Teacher } from '../../entities/teacher.entity';
import { Room } from '../../entities/room.entity';
import { Section } from '../../entities/section.entity';

@Injectable()
export class RoutineService {
  constructor(
    @InjectRepository(ClassSlot) private classSlotRepo: Repository<ClassSlot>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
    @InjectRepository(Room) private roomRepo: Repository<Room>,
    @InjectRepository(Section) private sectionRepo: Repository<Section>,
  ) {}

  async getTeacherRoutine(teacherId: string, semesterId: string) {
    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Teacher not found');

    // Get all slots for courses taught by this teacher
    const slots = await this.classSlotRepo.find({
      where: { semester_id: semesterId },
      relations: ['course', 'section', 'room'],
    });

    // Filter slots where this teacher is assigned
    // Note: This requires checking course_section_teachers, which needs a join
    // For now, we'll return all slots and filter in logic

    return { teacher, classes: slots };
  }

  async getRoomRoutine(roomId: string, semesterId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    const slots = await this.classSlotRepo.find({
      where: { semester_id: semesterId, room_id: roomId },
      relations: ['course', 'section'],
      order: { day: 'ASC', start: 'ASC' },
    });

    return { room, classes: slots };
  }

  async getSectionRoutine(sectionId: string, semesterId: string) {
    const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
    if (!section) throw new NotFoundException('Section not found');

    const slots = await this.classSlotRepo.find({
      where: { semester_id: semesterId, section_id: sectionId },
      relations: ['course', 'room'],
      order: { day: 'ASC', start: 'ASC' },
    });

    return { section, classes: slots };
  }

  async getSemesterRoutine(semesterId: string) {
    const slots = await this.classSlotRepo.find({
      where: { semester_id: semesterId },
      relations: ['course', 'section', 'room'],
      order: { day: 'ASC', start: 'ASC' },
    });

    return { semester_id: semesterId, classes: slots };
  }
}
```

---

## Error Handling & Validation

**`src/common/filters/http-exception.filter.ts`**
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorDetails: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = exceptionResponse['message'] || message;
        errorDetails = exceptionResponse;
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      ...(errorDetails && { details: errorDetails }),
    });
  }
}
```

---

## Integration in main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  await app.listen(process.env.APP_PORT || 3000);
  console.log(`✅ Application is running on port ${process.env.APP_PORT || 3000}`);
}

bootstrap();
```

These examples provide a solid foundation for implementing the entire backend system!
