# Routine Management System - Migration & Testing Guide

---

## Data Migration Strategy

### Phase 1: Preparation

#### 1. Backup Existing Data
```typescript
// Export localStorage data to JSON file
// This would be run in browser console or via script
const data = localStorage.getItem('rms-data-v2');
const file = new File([data], 'backup.json', { type: 'application/json' });
```

#### 2. Create Migration Scripts

**`src/scripts/migrate-seed-data.ts`**
```typescript
import { DataSource } from 'typeorm';
import { ormConfig } from '../../ormconfig';
import * as seedData from '../data/seed.json';
import { Teacher } from '../entities/teacher.entity';
import { Room } from '../entities/room.entity';
import { Section } from '../entities/section.entity';
import { Course } from '../entities/course.entity';
import { Period } from '../entities/period.entity';
import { Day } from '../entities/day.entity';
import { Semester } from '../entities/semester.entity';
import { ClassSlot } from '../entities/class-slot.entity';
import { CourseSectionTeacher } from '../entities/course-section-teacher.entity';

export async function migrateFromSeedJson() {
  const AppDataSource = new DataSource(ormConfig as any);
  await AppDataSource.initialize();

  try {
    console.log('🔄 Starting migration from seed.json...');

    const teacherRepo = AppDataSource.getRepository(Teacher);
    const roomRepo = AppDataSource.getRepository(Room);
    const sectionRepo = AppDataSource.getRepository(Section);
    const courseRepo = AppDataSource.getRepository(Course);
    const periodRepo = AppDataSource.getRepository(Period);
    const dayRepo = AppDataSource.getRepository(Day);
    const semesterRepo = AppDataSource.getRepository(Semester);
    const classSlotRepo = AppDataSource.getRepository(ClassSlot);
    const cstRepo = AppDataSource.getRepository(CourseSectionTeacher);

    // Create default semester
    const defaultSemester = semesterRepo.create({
      id: 'sem-winter-2026',
      name: 'Winter 2026',
      year: 2026,
      season: 'Winter',
    });
    await semesterRepo.save(defaultSemester);
    console.log('✅ Semester created');

    // Migrate teachers
    const teachers = await teacherRepo.save(seedData.teachers as any);
    console.log(`✅ ${teachers.length} teachers migrated`);

    // Migrate rooms
    const rooms = await roomRepo.save(seedData.rooms as any);
    console.log(`✅ ${rooms.length} rooms migrated`);

    // Migrate sections
    const sections = await sectionRepo.save(seedData.sections as any);
    console.log(`✅ ${sections.length} sections migrated`);

    // Migrate courses
    const courses = await courseRepo.save(seedData.courses as any);
    console.log(`✅ ${courses.length} courses migrated`);

    // Migrate periods
    const periods = await periodRepo.save(seedData.periods as any);
    console.log(`✅ ${periods.length} periods migrated`);

    // Migrate days
    const days = await dayRepo.save(seedData.days as any);
    console.log(`✅ ${days.length} days migrated`);

    // Migrate assignments and class slots
    const teacherMap = new Map(teachers.map(t => [t.short_name, t.id]));
    const roomMap = new Map(rooms.map(r => [r.name, r.id]));
    const courseMap = new Map(courses.map(c => [`${c.code}|${c.level}|${c.term}`, c.id]));
    const sectionMap = new Map(sections.map(s => [`${s.level}|${s.term}|${s.name}`, s.id]));

    const cstMap = new Map<string, CourseSectionTeacher>();

    for (const assignment of (seedData as any).assignments) {
      const courseId = courseMap.get(
        `${assignment.course_code}|${assignment.level}|${assignment.term}`
      );
      const sectionId = sectionMap.get(
        `${assignment.level}|${assignment.term}|${assignment.section_name}`
      );

      if (!courseId || !sectionId) continue;

      const teacherIds = assignment.teachers
        .map(sn => teacherMap.get(sn))
        .filter(id => !!id);

      const key = `${courseId}|${sectionId}`;
      if (!cstMap.has(key)) {
        cstMap.set(key, cstRepo.create({
          semester_id: defaultSemester.id,
          course_id: courseId,
          section_id: sectionId,
          teacher_ids: teacherIds,
        }));
      }

      // Migrate class slots
      for (const cls of assignment.classes) {
        const roomId = cls.room ? roomMap.get(cls.room) : null;

        await classSlotRepo.save({
          semester_id: defaultSemester.id,
          course_id: courseId,
          section_id: sectionId,
          room_id: roomId || null,
          day: cls.day,
          start: cls.start,
          end: cls.end,
          week: cls.week || 'EVERY',
        });
      }
    }

    // Save all course-section-teacher assignments
    await cstRepo.save(Array.from(cstMap.values()));
    console.log(`✅ Assignments and class slots migrated`);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await AppDataSource.destroy();
  }
}

// Run migration
migrateFromSeedJson().catch(console.error);
```

#### 3. Run Migration Script

**`package.json` scripts**
```json
{
  "scripts": {
    "migrate:seed": "npx ts-node -r tsconfig-paths/register src/scripts/migrate-seed-data.ts",
    "migrate:verify": "npx ts-node -r tsconfig-paths/register src/scripts/verify-migration.ts"
  }
}
```

### Phase 2: Verification

**`src/scripts/verify-migration.ts`**
```typescript
import { DataSource } from 'typeorm';
import { ormConfig } from '../../ormconfig';

export async function verifyMigration() {
  const AppDataSource = new DataSource(ormConfig as any);
  await AppDataSource.initialize();

  try {
    console.log('🔍 Verifying migration...\n');

    const teacherCount = await AppDataSource.query('SELECT COUNT(*) FROM teachers');
    const roomCount = await AppDataSource.query('SELECT COUNT(*) FROM rooms');
    const sectionCount = await AppDataSource.query('SELECT COUNT(*) FROM sections');
    const courseCount = await AppDataSource.query('SELECT COUNT(*) FROM courses');
    const slotCount = await AppDataSource.query('SELECT COUNT(*) FROM class_slots');
    const cstCount = await AppDataSource.query('SELECT COUNT(*) FROM course_section_teachers');

    console.log('Data Counts:');
    console.log(`  Teachers: ${teacherCount[0].count}`);
    console.log(`  Rooms: ${roomCount[0].count}`);
    console.log(`  Sections: ${sectionCount[0].count}`);
    console.log(`  Courses: ${courseCount[0].count}`);
    console.log(`  Class Slots: ${slotCount[0].count}`);
    console.log(`  Assignments: ${cstCount[0].count}`);

    // Verify data integrity
    console.log('\nData Integrity Checks:');

    // Check for orphaned slots
    const orphanedSlots = await AppDataSource.query(`
      SELECT COUNT(*) FROM class_slots cs
      WHERE NOT EXISTS (SELECT 1 FROM courses c WHERE c.id = cs.course_id)
    `);
    console.log(`  Orphaned class slots: ${orphanedSlots[0].count}`);

    // Check for missing rooms
    const missingRooms = await AppDataSource.query(`
      SELECT COUNT(*) FROM class_slots cs
      WHERE cs.room_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM rooms r WHERE r.id = cs.room_id)
    `);
    console.log(`  Class slots with missing rooms: ${missingRooms[0].count}`);

    // Check for invalid week patterns
    const invalidWeeks = await AppDataSource.query(`
      SELECT COUNT(*) FROM class_slots
      WHERE week NOT IN ('EVERY', 'EVEN', 'ODD')
    `);
    console.log(`  Invalid week patterns: ${invalidWeeks[0].count}`);

    if (
      parseInt(orphanedSlots[0].count) === 0 &&
      parseInt(missingRooms[0].count) === 0 &&
      parseInt(invalidWeeks[0].count) === 0
    ) {
      console.log('\n✅ All integrity checks passed!');
    } else {
      console.log('\n⚠️ Some integrity issues found!');
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

verifyMigration();
```

### Phase 3: Frontend Integration

**`src/api/client.ts`** (Frontend)
```typescript
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3201/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// API Service
export const api = {
  // Teachers
  teachers: {
    list: (page = 1, limit = 1000) => apiClient.get('/teachers', { params: { page, limit } }),
    get: (id: string) => apiClient.get(`/teachers/${id}`),
    create: (data: any) => apiClient.post('/teachers', data),
    update: (id: string, data: any) => apiClient.patch(`/teachers/${id}`, data),
    delete: (id: string) => apiClient.delete(`/teachers/${id}`),
  },
  
  // Rooms
  rooms: {
    list: () => apiClient.get('/rooms'),
    get: (id: string) => apiClient.get(`/rooms/${id}`),
    create: (data: any) => apiClient.post('/rooms', data),
    update: (id: string, data: any) => apiClient.patch(`/rooms/${id}`, data),
    delete: (id: string) => apiClient.delete(`/rooms/${id}`),
  },

  // Class Slots
  classSlots: {
    list: (semesterId: string) => apiClient.get('/class-slots', { params: { semester_id: semesterId } }),
    create: (data: any) => apiClient.post('/class-slots', data),
    update: (id: string, data: any) => apiClient.patch(`/class-slots/${id}`, data),
    delete: (id: string) => apiClient.delete(`/class-slots/${id}`),
    checkConflicts: (data: any) => apiClient.post('/class-slots/check-conflicts', data),
  },

  // ... other endpoints
};
```

**Update Zustand Store**
```typescript
// Before: Loading from localStorage with seed.json
// After: Loading from backend API

import { create } from 'zustand';
import { api } from '@/api/client';
import type { AppData } from './types';

interface StoreState extends AppData {
  // ... mutation methods
  loadFromBackend: (semesterId: string) => Promise<void>;
}

export const useStore = create<StoreState>((set) => ({
  // Initialize empty state
  teachers: [],
  rooms: [],
  sections: [],
  courses: [],
  periods: [],
  days: [],
  class_slots: [],
  course_section_teachers: [],
  semesters: [],
  active_semester_id: '',

  // Load all data from backend
  loadFromBackend: async (semesterId: string) => {
    try {
      const [teachersRes, roomsRes, sectionsRes, coursesRes, periodsRes, daysRes, slotsRes] = 
        await Promise.all([
          api.teachers.list(1, 1000),
          api.rooms.list(),
          api.sections.list(),
          api.courses.list(),
          api.periods.list(),
          api.days.list(),
          api.classSlots.list(semesterId),
        ]);

      set({
        teachers: teachersRes.data.data,
        rooms: roomsRes.data,
        sections: sectionsRes.data,
        courses: coursesRes.data,
        periods: periodsRes.data,
        days: daysRes.data,
        class_slots: slotsRes.data,
        active_semester_id: semesterId,
      });
    } catch (error) {
      console.error('Failed to load data from backend:', error);
    }
  },

  // Add methods now call backend API
  addTeacher: async (teacher: any) => {
    const res = await api.teachers.create(teacher);
    // Update local state
    set((s) => ({ teachers: [...s.teachers, res.data] }));
  },

  // ... other methods
}));
```

---

## Testing Strategy

### Unit Testing

**`src/modules/teachers/teachers.service.spec.ts`**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeachersService } from './teachers.service';
import { Teacher } from '../../entities/teacher.entity';
import { CreateTeacherDto } from '../../dtos/create-teacher.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('TeachersService', () => {
  let service: TeachersService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeachersService,
        {
          provide: getRepositoryToken(Teacher),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TeachersService>(TeachersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated teachers', async () => {
      const mockTeachers = [
        { id: '1', short_name: 'JA', name: 'Dr. Jahangir', designation: 'Professor', department: 'CSE', status: '', assigned_credit: 6.75 },
        { id: '2', short_name: 'MSA', name: 'Dr. Sowket', designation: 'Associate Professor', department: 'CSE', status: '', assigned_credit: 9.0 },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockTeachers, 2]);

      const result = await service.findAll(1, 20);

      expect(result).toEqual({
        data: mockTeachers,
        total: 2,
        page: 1,
        limit: 20,
        pages: 1,
      });
    });
  });

  describe('findById', () => {
    it('should return a teacher by id', async () => {
      const mockTeacher = { id: '1', short_name: 'JA', name: 'Dr. Jahangir' };
      mockRepository.findOne.mockResolvedValue(mockTeacher);

      const result = await service.findById('1');

      expect(result).toEqual(mockTeacher);
    });

    it('should throw NotFoundException if teacher not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new teacher', async () => {
      const dto: CreateTeacherDto = {
        short_name: 'JA',
        name: 'Dr. Jahangir',
        designation: 'Professor',
        department: 'CSE',
      };

      const mockTeacher = { id: '1', ...dto };
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(dto);
      mockRepository.save.mockResolvedValue(mockTeacher);

      const result = await service.create(dto);

      expect(result).toEqual(mockTeacher);
    });

    it('should throw ConflictException if short_name already exists', async () => {
      const dto: CreateTeacherDto = {
        short_name: 'JA',
        name: 'Dr. Jahangir',
        designation: 'Professor',
        department: 'CSE',
      };

      mockRepository.findOne.mockResolvedValue({ id: '1', short_name: 'JA' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update a teacher', async () => {
      const existing = { id: '1', short_name: 'JA', name: 'Dr. Jahangir', department: 'CSE' };
      const dto = { name: 'Dr. Jahangir Alam' };
      const updated = { ...existing, ...dto };

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.update('1', dto);

      expect(result.name).toBe('Dr. Jahangir Alam');
    });
  });

  describe('delete', () => {
    it('should delete a teacher', async () => {
      const mockTeacher = { id: '1', short_name: 'JA' };
      mockRepository.findOne.mockResolvedValue(mockTeacher);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.delete('1');

      expect(mockRepository.remove).toHaveBeenCalledWith(mockTeacher);
    });
  });
});
```

### Integration Testing

**`src/modules/teachers/teachers.e2e.spec.ts`**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

describe('Teachers E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear database before each test
    await dataSource.query('DELETE FROM teachers');
  });

  describe('POST /api/teachers', () => {
    it('should create a new teacher', async () => {
      const dto = {
        short_name: 'JA',
        name: 'Dr. Jahangir',
        designation: 'Professor',
        department: 'CSE',
        status: 'Librarian',
        assigned_credit: 6.75,
      };

      return request(app.getHttpServer())
        .post('/api/teachers')
        .send(dto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.short_name).toBe('JA');
        });
    });

    it('should reject duplicate short_name', async () => {
      const dto = {
        short_name: 'JA',
        name: 'Dr. Jahangir',
        designation: 'Professor',
        department: 'CSE',
      };

      await request(app.getHttpServer()).post('/api/teachers').send(dto).expect(201);

      return request(app.getHttpServer())
        .post('/api/teachers')
        .send(dto)
        .expect(409);
    });
  });

  describe('GET /api/teachers', () => {
    it('should return all teachers', async () => {
      const dto = {
        short_name: 'JA',
        name: 'Dr. Jahangir',
        designation: 'Professor',
        department: 'CSE',
      };

      await request(app.getHttpServer()).post('/api/teachers').send(dto);

      return request(app.getHttpServer())
        .get('/api/teachers')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.total).toBe(1);
        });
    });
  });

  describe('PATCH /api/teachers/:id', () => {
    it('should update a teacher', async () => {
      const dto = {
        short_name: 'JA',
        name: 'Dr. Jahangir',
        designation: 'Professor',
        department: 'CSE',
      };

      const createRes = await request(app.getHttpServer())
        .post('/api/teachers')
        .send(dto)
        .expect(201);

      const teacherId = createRes.body.id;

      return request(app.getHttpServer())
        .patch(`/api/teachers/${teacherId}`)
        .send({ designation: 'Associate Professor' })
        .expect(200)
        .expect((res) => {
          expect(res.body.designation).toBe('Associate Professor');
        });
    });
  });

  describe('DELETE /api/teachers/:id', () => {
    it('should delete a teacher', async () => {
      const dto = {
        short_name: 'JA',
        name: 'Dr. Jahangir',
        designation: 'Professor',
        department: 'CSE',
      };

      const createRes = await request(app.getHttpServer())
        .post('/api/teachers')
        .send(dto)
        .expect(201);

      const teacherId = createRes.body.id;

      await request(app.getHttpServer()).delete(`/api/teachers/${teacherId}`).expect(200);

      return request(app.getHttpServer())
        .get(`/api/teachers/${teacherId}`)
        .expect(404);
    });
  });
});
```

### Conflict Detection Testing

**`src/modules/class-slots/conflicts.service.spec.ts`**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictsService } from './conflicts.service';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';

describe('ConflictsService', () => {
  let service: ConflictsService;
  let mockClassSlotRepo: any;
  let mockCourseRepo: any;
  let mockSectionRepo: any;
  let mockRoomRepo: any;
  let mockCstRepo: any;

  beforeEach(async () => {
    mockClassSlotRepo = { find: jest.fn() };
    mockCourseRepo = { findOne: jest.fn() };
    mockSectionRepo = { findOne: jest.fn() };
    mockRoomRepo = { findOne: jest.fn() };
    mockCstRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictsService,
        { provide: getRepositoryToken(ClassSlot), useValue: mockClassSlotRepo },
        { provide: getRepositoryToken(Course), useValue: mockCourseRepo },
        { provide: getRepositoryToken(Section), useValue: mockSectionRepo },
        { provide: getRepositoryToken(Room), useValue: mockRoomRepo },
        { provide: getRepositoryToken(CourseSectionTeacher), useValue: mockCstRepo },
      ],
    }).compile();

    service = module.get<ConflictsService>(ConflictsService);
  });

  describe('checkConflicts', () => {
    it('should detect room capacity conflict', async () => {
      mockCourseRepo.findOne.mockResolvedValue({
        id: '1',
        course_type: 'theory_2.0',
      });
      mockSectionRepo.findOne.mockResolvedValue({
        id: '1',
        total_students: 100,
      });
      mockRoomRepo.findOne.mockResolvedValue({
        id: '1',
        name: 'Room 101',
        capacity: 50,
      });

      const dto = {
        semester_id: 'sem-1',
        course_id: '1',
        section_id: '1',
        teacher_ids: [],
        candidate: {
          day: 'Sunday',
          start: '08:30',
          end: '09:30',
          room_id: '1',
          week: 'EVERY',
        },
      };

      const conflicts = await service.checkConflicts(dto);

      expect(conflicts).toContainEqual(
        expect.objectContaining({
          type: 'room_capacity',
        })
      );
    });

    it('should detect room double booking conflict', async () => {
      mockCourseRepo.findOne.mockResolvedValue({
        id: '1',
        course_type: 'theory_2.0',
      });
      mockSectionRepo.findOne.mockResolvedValue({
        id: '1',
        total_students: 50,
      });
      mockRoomRepo.findOne.mockResolvedValue({
        id: 'room-1',
        name: 'Room 101',
        capacity: 50,
        room_type: 'Theory',
      });
      mockClassSlotRepo.find.mockResolvedValue([
        {
          id: 'slot-1',
          room_id: 'room-1',
          day: 'Sunday',
          start: '08:30',
          end: '09:30',
          week: 'EVERY',
          course: { code: 'CSE101' },
          section: { name: 'A' },
        },
      ]);

      const dto = {
        semester_id: 'sem-1',
        course_id: '1',
        section_id: '1',
        teacher_ids: [],
        candidate: {
          day: 'Sunday',
          start: '08:45', // Overlapping time
          end: '09:45',
          room_id: 'room-1',
          week: 'EVERY',
        },
      };

      const conflicts = await service.checkConflicts(dto);

      expect(conflicts).toContainEqual(
        expect.objectContaining({
          type: 'room_double',
        })
      );
    });

    it('should not detect conflict for EVEN/ODD week pattern', async () => {
      mockCourseRepo.findOne.mockResolvedValue({
        id: '1',
        course_type: 'theory_2.0',
      });
      mockSectionRepo.findOne.mockResolvedValue({
        id: '1',
        total_students: 50,
      });
      mockRoomRepo.findOne.mockResolvedValue({
        id: 'room-1',
        name: 'Room 101',
        capacity: 50,
        room_type: 'Theory',
      });
      mockClassSlotRepo.find.mockResolvedValue([
        {
          id: 'slot-1',
          room_id: 'room-1',
          day: 'Sunday',
          start: '08:30',
          end: '09:30',
          week: 'EVEN', // Different week pattern
          course: { code: 'CSE101' },
          section: { name: 'A' },
        },
      ]);

      const dto = {
        semester_id: 'sem-1',
        course_id: '1',
        section_id: '1',
        teacher_ids: [],
        candidate: {
          day: 'Sunday',
          start: '08:30',
          end: '09:30',
          room_id: 'room-1',
          week: 'ODD', // Different week pattern
        },
      };

      const conflicts = await service.checkConflicts(dto);

      expect(conflicts.filter(c => c.type === 'room_double')).toHaveLength(0);
    });
  });
});
```

---

## Performance Testing

**`src/scripts/load-test.ts`** (Using Apache JMeter or k6)
```typescript
// Using k6 for load testing
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m30s', target: 100 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% of requests below 1.5s
  },
};

export default function () {
  // Test GET /api/teachers
  const teachersRes = http.get('http://localhost:3201/api/teachers');
  check(teachersRes, {
    'teachers list status is 200': (r) => r.status === 200,
    'teachers list duration < 500ms': (r) => r.timings.duration < 500,
  });

  // Test GET /api/class-slots
  const slotsRes = http.get(
    'http://localhost:3201/api/class-slots?semester_id=sem-winter-2026'
  );
  check(slotsRes, {
    'class slots status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

Run load test:
```bash
k6 run src/scripts/load-test.ts
```

---

## Production Deployment Checklist

- [ ] All tests passing
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Secrets stored securely
- [ ] API documentation generated
- [ ] Error logging configured
- [ ] Database backups scheduled
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] SSL/TLS certificate installed
- [ ] Monitoring and alerts set up
- [ ] Rollback plan documented
- [ ] Team trained on backend usage

---

## Troubleshooting Common Issues

### Issue: Migration Fails
- Ensure PostgreSQL is running: `docker ps`
- Check database connection: `psql -U routine_user -d routine_db`
- View migration logs: `npm run typeorm migration:show`

### Issue: Conflicts Not Detected
- Verify `week` field is properly saved
- Check time comparison logic in conflicts service
- Add logging to debug conflict calculations

### Issue: Slow Queries
- Check indexes are created: `\d class_slots` in psql
- Use EXPLAIN ANALYZE on slow queries
- Consider adding composite indexes

### Issue: TypeORM Relations Not Populated
- Verify `relations: ['course', 'section']` in queries
- Use `leftJoinAndSelect` for LEFT JOIN behavior
- Check foreign key constraints

See [BACKEND_DOCUMENTATION.md](./BACKEND_DOCUMENTATION.md) for more details.
