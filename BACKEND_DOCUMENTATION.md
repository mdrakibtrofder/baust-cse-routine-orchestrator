# Routine Management System - Backend Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Entity Models](#entity-models)
5. [API Endpoints](#api-endpoints)
6. [Project Structure](#project-structure)
7. [Setup & Installation](#setup--installation)
8. [Implementation Guide](#implementation-guide)
9. [Migration Strategy](#migration-strategy)

---

## Overview

This document provides comprehensive guidelines for building a NestJS backend for the Routine Management System. The system manages:

- **Teachers**: Faculty members with designations, departments, and credit assignments
- **Rooms**: Lecture halls with different capacities and types (Theory/Sessional)
- **Sections**: Student groups by level, term, and name
- **Courses**: Academic courses with credit hours and types
- **Periods**: Time slots throughout the academic day
- **Days**: Days of the academic week
- **Class Slots**: Individual class meetings (day, time, room, week pattern)
- **Course-Section-Teacher Assignments**: Mapping which teachers teach which courses to which sections
- **Semesters**: Academic terms (Winter/Summer, by year)

### Key Features
- Multi-semester support
- Conflict detection (room double-booking, teacher availability, room capacity)
- Support for odd/even week patterns
- Flexible room and teacher assignments
- Comprehensive course load management

---

## Architecture

### Technology Stack
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Validation**: class-validator
- **API**: RESTful with JSON responses
- **Authentication**: JWT (recommended)

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│              (baust-cse-routine-management-system)          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST API
┌────────────────────────▼────────────────────────────────────┐
│                     NestJS Backend                          │
├─────────────────────────────────────────────────────────────┤
│  Controllers │ Services │ Repositories │ Entities          │
└────────────────────────┬────────────────────────────────────┘
                         │ SQL Queries
┌────────────────────────▼────────────────────────────────────┐
│                   PostgreSQL Database                       │
│  (teachers, rooms, sections, courses, class_slots, etc.)   │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns

1. **NestJS Modules**: Organize features by domain (teachers, courses, routine, etc.)
2. **Dependency Injection**: All services injected via NestJS containers
3. **Repository Pattern**: Data access through repositories
4. **Service Layer**: Business logic in services
5. **DTOs**: Data Transfer Objects for validation and serialization
6. **Global Pipes**: Validation and transformation pipes
7. **Error Handling**: Centralized exception handling

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐
│   SEMESTERS     │
│  - id (PK)      │
│  - name         │
│  - year         │
│  - season       │
└────────┬────────┘
         │ 1:N
         │
    ┌────┴────────────────────────────────────┐
    │                                         │
    ▼                                         ▼
┌──────────────────┐              ┌──────────────────────┐
│  CLASS_SLOTS     │              │ COURSE_SECTION_TEACHERS
│  - id (PK)       │              │ - id (PK)            │
│  - semester_id   ◄──────────────┤ - semester_id        │
│  - course_id     │              │ - course_id          │
│  - section_id    │              │ - section_id         │
│  - day           │              │ - teacher_ids[]      │
│  - start         │              └──────────────────────┘
│  - end           │              (PostgreSQL ARRAY type)
│  - room_id       │
│  - week          │
└──────────────────┘

┌────────────────┐        ┌────────────────┐
│   TEACHERS     │        │     ROOMS      │
│ - id (PK)      │        │ - id (PK)      │
│ - short_name   │        │ - name         │
│ - name         │        │ - room_type    │
│ - designation  │        │ - capacity     │
│ - department   │        └────────────────┘
│ - status       │
│ - assigned_    │
│   credit       │
└────────────────┘

┌────────────────┐        ┌────────────────┐
│   SECTIONS     │        │    COURSES     │
│ - id (PK)      │        │ - id (PK)      │
│ - level        │        │ - code         │
│ - term         │        │ - name         │
│ - name         │        │ - credit       │
│ - total_       │        │ - course_type  │
│   students     │        │ - level        │
└────────────────┘        │ - term         │
                          │ - theory       │
                          │ - sessional    │
                          └────────────────┘

┌────────────────┐        ┌────────────────┐
│    PERIODS     │        │      DAYS      │
│ - id (PK)      │        │ - id (PK)      │
│ - name         │        │ - name         │
│ - start        │        └────────────────┘
│ - end          │
│ - duration     │
│ - kind         │
└────────────────┘
```

### SQL Schema Creation

```sql
-- Semesters Table
CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  season VARCHAR(20) NOT NULL CHECK (season IN ('Winter', 'Summer')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teachers Table
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_name VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  status VARCHAR(100) DEFAULT '',
  assigned_credit NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rooms Table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('Theory', 'Sessional')),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sections Table
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level INTEGER NOT NULL CHECK (level > 0),
  term VARCHAR(10) NOT NULL CHECK (term IN ('I', 'II')),
  name VARCHAR(50) NOT NULL,
  total_students INTEGER NOT NULL CHECK (total_students > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(level, term, name)
);

-- Courses Table
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  credit NUMERIC(3,2) NOT NULL CHECK (credit > 0),
  course_type VARCHAR(20) NOT NULL CHECK (course_type IN ('theory_2.0', 'theory_3.0', 'sessional_1.5', 'sessional_0.75')),
  level INTEGER NOT NULL CHECK (level > 0),
  term VARCHAR(10) NOT NULL CHECK (term IN ('I', 'II')),
  theory INTEGER NOT NULL DEFAULT 0,
  sessional INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(code, level, term)
);

-- Periods Table
CREATE TABLE periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  start TIME NOT NULL,
  end TIME NOT NULL,
  duration INTEGER NOT NULL CHECK (duration > 0),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('theory', 'sessional')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Days Table
CREATE TABLE days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Class Slots Table
CREATE TABLE class_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  day VARCHAR(50) NOT NULL,
  start TIME NOT NULL,
  end TIME NOT NULL,
  week VARCHAR(20) NOT NULL CHECK (week IN ('EVERY', 'EVEN', 'ODD')) DEFAULT 'EVERY',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (semester_id, course_id, section_id) REFERENCES course_section_teachers(semester_id, course_id, section_id)
);

-- Course Section Teachers Table (Many-to-Many relationship)
CREATE TABLE course_section_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  teacher_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(semester_id, course_id, section_id)
);

-- Create Indexes for Performance
CREATE INDEX idx_class_slots_semester ON class_slots(semester_id);
CREATE INDEX idx_class_slots_course ON class_slots(course_id);
CREATE INDEX idx_class_slots_section ON class_slots(section_id);
CREATE INDEX idx_class_slots_room ON class_slots(room_id);
CREATE INDEX idx_course_section_teachers_semester ON course_section_teachers(semester_id);
CREATE INDEX idx_course_section_teachers_composite ON course_section_teachers(semester_id, course_id, section_id);
CREATE INDEX idx_courses_level_term ON courses(level, term);
CREATE INDEX idx_sections_level_term ON sections(level, term);
```

---

## Entity Models

### TypeORM Entity Classes

#### 1. Semester Entity
```typescript
// src/entities/semester.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ClassSlot } from './class-slot.entity';
import { CourseSectionTeacher } from './course-section-teacher.entity';

@Entity('semesters')
export class Semester {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'integer' })
  year: number;

  @Column({ type: 'varchar', length: 20, enum: ['Winter', 'Summer'] })
  season: 'Winter' | 'Summer';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ClassSlot, slot => slot.semester)
  classSlots: ClassSlot[];

  @OneToMany(() => CourseSectionTeacher, cst => cst.semester)
  courseSectionTeachers: CourseSectionTeacher[];
}
```

#### 2. Teacher Entity
```typescript
// src/entities/teacher.entity.ts
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

#### 3. Room Entity
```typescript
// src/entities/room.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('rooms')
@Index(['name'], { unique: true })
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, enum: ['Theory', 'Sessional'] })
  room_type: 'Theory' | 'Sessional';

  @Column({ type: 'integer' })
  capacity: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

#### 4. Section Entity
```typescript
// src/entities/section.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('sections')
@Index(['level', 'term', 'name'], { unique: true })
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer' })
  level: number;

  @Column({ type: 'varchar', length: 10, enum: ['I', 'II'] })
  term: 'I' | 'II';

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'integer' })
  total_students: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

#### 5. Course Entity
```typescript
// src/entities/course.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

type CourseType = 'theory_2.0' | 'theory_3.0' | 'sessional_1.5' | 'sessional_0.75';

@Entity('courses')
@Index(['code'], { unique: true })
@Index(['level', 'term'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'numeric', precision: 3, scale: 2 })
  credit: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['theory_2.0', 'theory_3.0', 'sessional_1.5', 'sessional_0.75'],
  })
  course_type: CourseType;

  @Column({ type: 'integer' })
  level: number;

  @Column({ type: 'varchar', length: 10, enum: ['I', 'II'] })
  term: 'I' | 'II';

  @Column({ type: 'integer', default: 0 })
  theory: number;

  @Column({ type: 'integer', default: 0 })
  sessional: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

#### 6. Period Entity
```typescript
// src/entities/period.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('periods')
export class Period {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'time' })
  start: string;

  @Column({ type: 'time' })
  end: string;

  @Column({ type: 'integer' })
  duration: number;

  @Column({ type: 'varchar', length: 20, enum: ['theory', 'sessional'] })
  kind: 'theory' | 'sessional';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

#### 7. Day Entity
```typescript
// src/entities/day.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('days')
@Index(['name'], { unique: true })
export class Day {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

#### 8. ClassSlot Entity
```typescript
// src/entities/class-slot.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Course } from './course.entity';
import { Section } from './section.entity';
import { Room } from './room.entity';

@Entity('class_slots')
@Index(['semester_id', 'course_id', 'section_id'])
@Index(['semester_id', 'room_id'])
export class ClassSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  course_id: string;

  @Column({ type: 'uuid' })
  section_id: string;

  @Column({ type: 'uuid', nullable: true })
  room_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  day: string;

  @Column({ type: 'time' })
  start: string;

  @Column({ type: 'time' })
  end: string;

  @Column({ type: 'varchar', length: 20, enum: ['EVERY', 'EVEN', 'ODD'], default: 'EVERY' })
  week: 'EVERY' | 'EVEN' | 'ODD';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Semester, semester => semester.classSlots)
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @ManyToOne(() => Section)
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @ManyToOne(() => Room, { nullable: true })
  @JoinColumn({ name: 'room_id' })
  room: Room | null;
}
```

#### 9. CourseSectionTeacher Entity
```typescript
// src/entities/course-section-teacher.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Semester } from './semester.entity';
import { Course } from './course.entity';
import { Section } from './section.entity';

@Entity('course_section_teachers')
@Index(['semester_id', 'course_id', 'section_id'], { unique: true })
export class CourseSectionTeacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  course_id: string;

  @Column({ type: 'uuid' })
  section_id: string;

  @Column({ type: 'uuid', array: true, default: () => 'array[]::uuid[]' })
  teacher_ids: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Semester)
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @ManyToOne(() => Section)
  @JoinColumn({ name: 'section_id' })
  section: Section;
}
```

---

## API Endpoints

For a detailed, up-to-date list of all endpoints, please refer to the [API Reference](API_REFERENCE.md).

The system also provides interactive Swagger documentation available at `/api/docs`.

### 1. Semesters

```
GET    /api/semesters              - List all semesters
POST   /api/semesters              - Create new semester
GET    /api/semesters/:id          - Get semester by ID
PATCH  /api/semesters/:id          - Update semester
DELETE /api/semesters/:id          - Delete semester
GET    /api/semesters/active       - Get active semester
PATCH  /api/semesters/:id/active   - Set as active semester
```

**Request/Response Examples:**

```typescript
// POST /api/semesters
// Body:
{
  "name": "Winter 2026",
  "year": 2026,
  "season": "Winter"
}

// Response:
{
  "id": "uuid-here",
  "name": "Winter 2026",
  "year": 2026,
  "season": "Winter",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

### 2. Teachers

```
GET    /api/teachers              - List all teachers (paginated)
POST   /api/teachers              - Create new teacher
GET    /api/teachers/:id          - Get teacher by ID
PATCH  /api/teachers/:id          - Update teacher
DELETE /api/teachers/:id          - Delete teacher
POST   /api/teachers/import       - Bulk import from CSV/JSON
POST   /api/teachers/:id/move-assignments  - Move teacher assignments
```

**Request/Response Examples:**

```typescript
// POST /api/teachers
// Body:
{
  "short_name": "JA",
  "name": "Dr. S.M. Jahangir Alam",
  "designation": "Professor",
  "department": "CSE",
  "status": "Librarian",
  "assigned_credit": 6.75
}

// Response:
{
  "id": "uuid-here",
  "short_name": "JA",
  "name": "Dr. S.M. Jahangir Alam",
  "designation": "Professor",
  "department": "CSE",
  "status": "Librarian",
  "assigned_credit": 6.75,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}

// POST /api/teachers?page=1&limit=20
// Response:
{
  "data": [...],
  "total": 50,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

### 3. Rooms

```
GET    /api/rooms                 - List all rooms
POST   /api/rooms                 - Create new room
GET    /api/rooms/:id             - Get room by ID
PATCH  /api/rooms/:id             - Update room
DELETE /api/rooms/:id             - Delete room
GET    /api/rooms/availability    - Check room availability for time slot
```

**Request/Response Examples:**

```typescript
// POST /api/rooms
// Body:
{
  "name": "Room 101",
  "room_type": "Theory",
  "capacity": 50
}

// Response:
{
  "id": "uuid-here",
  "name": "Room 101",
  "room_type": "Theory",
  "capacity": 50,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

### 4. Sections

```
GET    /api/sections              - List sections (filterable by level/term)
POST   /api/sections              - Create new section
GET    /api/sections/:id          - Get section by ID
PATCH  /api/sections/:id          - Update section
DELETE /api/sections/:id          - Delete section
GET    /api/sections/by-level/:level/term/:term - Get sections by level/term
```

**Request/Response Examples:**

```typescript
// GET /api/sections?level=1&term=I
// Response:
[
  {
    "id": "uuid-here",
    "level": 1,
    "term": "I",
    "name": "A",
    "total_students": 50,
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-01-15T10:30:00Z"
  },
  ...
]
```

### 5. Courses

```
GET    /api/courses               - List courses (filterable by level/term)
POST   /api/courses               - Create new course
GET    /api/courses/:id           - Get course by ID
PATCH  /api/courses/:id           - Update course
DELETE /api/courses/:id           - Delete course
GET    /api/courses/by-level/:level/term/:term - Get courses by level/term
```

**Request/Response Examples:**

```typescript
// POST /api/courses
// Body:
{
  "code": "CSE101",
  "name": "Introduction to Programming",
  "credit": 3.0,
  "course_type": "theory_3.0",
  "level": 1,
  "term": "I",
  "theory": 3,
  "sessional": 0
}

// Response:
{
  "id": "uuid-here",
  "code": "CSE101",
  "name": "Introduction to Programming",
  "credit": 3.0,
  "course_type": "theory_3.0",
  "level": 1,
  "term": "I",
  "theory": 3,
  "sessional": 0,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

### 6. Periods

```
GET    /api/periods               - List all periods
POST   /api/periods               - Create new period
GET    /api/periods/:id           - Get period by ID
PATCH  /api/periods/:id           - Update period (propagates to class slots)
DELETE /api/periods/:id           - Delete period
GET    /api/periods/by-kind/:kind - Get periods by kind (theory/sessional)
```

**Request/Response Examples:**

```typescript
// POST /api/periods
// Body:
{
  "name": "Period 1",
  "start": "08:30",
  "end": "09:30",
  "duration": 60,
  "kind": "theory"
}

// Response:
{
  "id": "uuid-here",
  "name": "Period 1",
  "start": "08:30",
  "end": "09:30",
  "duration": 60,
  "kind": "theory",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

### 7. Days

```
GET    /api/days                  - List all days
POST   /api/days                  - Create new day
GET    /api/days/:id              - Get day by ID
DELETE /api/days/:id              - Delete day
```

**Request/Response Examples:**

```typescript
// POST /api/days
// Body:
{
  "name": "Sunday"
}

// Response:
{
  "id": "uuid-here",
  "name": "Sunday",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

### 8. Class Slots

```
GET    /api/class-slots           - List class slots (by semester)
POST   /api/class-slots           - Create new class slot
GET    /api/class-slots/:id       - Get class slot by ID
PATCH  /api/class-slots/:id       - Update class slot
DELETE /api/class-slots/:id       - Delete class slot
DELETE /api/class-slots/course/:courseId/section/:sectionId - Delete slots for course-section
POST   /api/class-slots/check-conflicts - Validate class slot conflicts
```

**Request/Response Examples:**

```typescript
// POST /api/class-slots
// Body:
{
  "semester_id": "uuid-here",
  "course_id": "uuid-here",
  "section_id": "uuid-here",
  "day": "Sunday",
  "start": "08:30",
  "end": "09:30",
  "room_id": "uuid-here",
  "week": "EVERY"
}

// Response:
{
  "id": "uuid-here",
  "semester_id": "uuid-here",
  "course_id": "uuid-here",
  "section_id": "uuid-here",
  "day": "Sunday",
  "start": "08:30",
  "end": "09:30",
  "room_id": "uuid-here",
  "week": "EVERY",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}

// POST /api/class-slots/check-conflicts
// Body:
{
  "semester_id": "uuid-here",
  "course_id": "uuid-here",
  "section_id": "uuid-here",
  "teacher_ids": ["uuid1", "uuid2"],
  "candidate": {
    "day": "Sunday",
    "start": "08:30",
    "end": "09:30",
    "room_id": "uuid-here",
    "week": "EVERY"
  }
}

// Response:
{
  "conflicts": [
    {
      "type": "room_double",
      "message": "Room 101 already booked Sunday 08:30-09:30 by CSE101 (Sec A)."
    }
  ],
  "hasConflicts": true
}
```

### 9. Course-Section-Teacher Assignments

```
GET    /api/assignments           - List all assignments (by semester)
POST   /api/assignments           - Create/update assignment
GET    /api/assignments/course/:courseId/section/:sectionId - Get assignment
DELETE /api/assignments/:id       - Delete assignment
GET    /api/assignments/teacher/:teacherId - Get teacher's assignments
```

**Request/Response Examples:**

```typescript
// POST /api/assignments
// Body:
{
  "semester_id": "uuid-here",
  "course_id": "uuid-here",
  "section_id": "uuid-here",
  "teacher_ids": ["uuid1", "uuid2"]
}

// Response:
{
  "id": "uuid-here",
  "semester_id": "uuid-here",
  "course_id": "uuid-here",
  "section_id": "uuid-here",
  "teacher_ids": ["uuid1", "uuid2"],
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

### 10. Routine/Schedule Views (Composite)

```
GET    /api/routine/teacher/:teacherId - Get teacher's full routine
GET    /api/routine/room/:roomId     - Get room's full routine
GET    /api/routine/section/:sectionId - Get section's full routine
GET    /api/routine/semester/:semesterId - Get full semester routine
```

**Request/Response Examples:**

```typescript
// GET /api/routine/teacher/{teacherId}?semester_id=uuid-here
// Response:
{
  "teacher": { /* teacher object */ },
  "classes": [
    {
      "id": "uuid-here",
      "course": { /* course object */ },
      "section": { /* section object */ },
      "day": "Sunday",
      "start": "08:30",
      "end": "09:30",
      "room": { /* room object */ },
      "week": "EVERY"
    },
    ...
  ]
}
```

### Error Responses

```typescript
// 400 Bad Request
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "name": "name is required"
  }
}

// 404 Not Found
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Teacher with ID xxx not found"
}

// 409 Conflict
{
  "statusCode": 409,
  "message": "Conflict detected",
  "conflicts": [
    {
      "type": "room_double",
      "message": "Room already booked for this time"
    }
  ]
}

// 500 Internal Server Error
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "An unexpected error occurred"
}
```

---

## Project Structure

```
routine-management-backend/
├── src/
│   ├── app.module.ts                      # Root module
│   ├── main.ts                            # Entry point
│   ├── common/
│   │   ├── decorators/                    # Custom decorators
│   │   ├── filters/                       # Exception filters
│   │   ├── guards/                        # Auth guards (JWT, etc.)
│   │   ├── interceptors/                  # Response interceptors
│   │   ├── pipes/                         # Validation pipes
│   │   └── utils/                         # Shared utilities
│   ├── config/
│   │   ├── database.config.ts             # TypeORM config
│   │   ├── env.config.ts                  # Environment config
│   │   └── constants.ts                   # App constants
│   ├── entities/
│   │   ├── semester.entity.ts
│   │   ├── teacher.entity.ts
│   │   ├── room.entity.ts
│   │   ├── section.entity.ts
│   │   ├── course.entity.ts
│   │   ├── period.entity.ts
│   │   ├── day.entity.ts
│   │   ├── class-slot.entity.ts
│   │   └── course-section-teacher.entity.ts
│   ├── dtos/
│   │   ├── create-semester.dto.ts
│   │   ├── update-semester.dto.ts
│   │   ├── create-teacher.dto.ts
│   │   ├── update-teacher.dto.ts
│   │   ├── create-room.dto.ts
│   │   ├── update-room.dto.ts
│   │   ├── create-section.dto.ts
│   │   ├── update-section.dto.ts
│   │   ├── create-course.dto.ts
│   │   ├── update-course.dto.ts
│   │   ├── create-period.dto.ts
│   │   ├── update-period.dto.ts
│   │   ├── create-class-slot.dto.ts
│   │   ├── update-class-slot.dto.ts
│   │   ├── create-assignment.dto.ts
│   │   ├── check-conflicts.dto.ts
│   │   └── pagination.dto.ts
│   ├── modules/
│   │   ├── semesters/
│   │   │   ├── semesters.module.ts
│   │   │   ├── semesters.service.ts
│   │   │   ├── semesters.controller.ts
│   │   │   └── semesters.repository.ts
│   │   ├── teachers/
│   │   │   ├── teachers.module.ts
│   │   │   ├── teachers.service.ts
│   │   │   ├── teachers.controller.ts
│   │   │   └── teachers.repository.ts
│   │   ├── rooms/
│   │   │   ├── rooms.module.ts
│   │   │   ├── rooms.service.ts
│   │   │   ├── rooms.controller.ts
│   │   │   └── rooms.repository.ts
│   │   ├── sections/
│   │   │   ├── sections.module.ts
│   │   │   ├── sections.service.ts
│   │   │   ├── sections.controller.ts
│   │   │   └── sections.repository.ts
│   │   ├── courses/
│   │   │   ├── courses.module.ts
│   │   │   ├── courses.service.ts
│   │   │   ├── courses.controller.ts
│   │   │   └── courses.repository.ts
│   │   ├── periods/
│   │   │   ├── periods.module.ts
│   │   │   ├── periods.service.ts
│   │   │   ├── periods.controller.ts
│   │   │   └── periods.repository.ts
│   │   ├── days/
│   │   │   ├── days.module.ts
│   │   │   ├── days.service.ts
│   │   │   ├── days.controller.ts
│   │   │   └── days.repository.ts
│   │   ├── class-slots/
│   │   │   ├── class-slots.module.ts
│   │   │   ├── class-slots.service.ts
│   │   │   ├── class-slots.controller.ts
│   │   │   ├── class-slots.repository.ts
│   │   │   ├── conflicts.service.ts
│   │   │   └── routine.service.ts
│   │   ├── assignments/
│   │   │   ├── assignments.module.ts
│   │   │   ├── assignments.service.ts
│   │   │   ├── assignments.controller.ts
│   │   │   └── assignments.repository.ts
│   │   ├── seed/
│   │   │   ├── seed.module.ts
│   │   │   ├── seed.service.ts
│   │   │   └── seed.controller.ts (optional)
│   │   └── auth/ (optional, for JWT)
│   │       ├── auth.module.ts
│   │       ├── auth.service.ts
│   │       ├── auth.controller.ts
│   │       └── jwt.strategy.ts
│   └── migrations/
│       └── [timestamp]-init.ts
├── test/
│   ├── unit/
│   └── e2e/
├── .env.example
├── .env
├── .env.test
├── ormconfig.ts                   # TypeORM configuration file
├── package.json
├── tsconfig.json
└── README.md
```

---

## Setup & Installation

### Prerequisites
- Node.js (v18+)
- npm or yarn or pnpm
- PostgreSQL (v13+)
- Docker (optional, for PostgreSQL)

### Step 1: Initialize NestJS Project

```bash
npm i -g @nestjs/cli
nest new routine-management-backend
cd routine-management-backend
```

### Step 2: Install Dependencies

```bash
npm install --save @nestjs/typeorm typeorm pg
npm install --save class-validator class-transformer
npm install --save @nestjs/config dotenv
npm install --save uuid
npm install --save-dev @types/node typescript ts-loader
```

Optional (for JWT auth):
```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install --save-dev @types/passport-jwt
```

### Step 3: PostgreSQL Setup

**Option A: Using Docker**
```bash
docker run --name routine-db \
  -e POSTGRES_USER=routine_user \
  -e POSTGRES_PASSWORD=routine_pass \
  -e POSTGRES_DB=routine_db \
  -p 5432:5432 \
  -d postgres:16-alpine
```

**Option B: Local PostgreSQL**
```bash
createdb routine_db
# Create user (optional)
psql routine_db -c "CREATE USER routine_user WITH PASSWORD 'routine_pass';"
```

### Step 4: Environment Configuration

Create `.env` file:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=routine_user
DB_PASSWORD=routine_pass
DB_NAME=routine_db

# App
NODE_ENV=development
APP_PORT=3201
APP_PREFIX=api

# JWT (optional)
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
```

### Step 5: TypeORM Configuration

Create `ormconfig.ts`:
```typescript
import { DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const ormConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'routine_user',
  password: process.env.DB_PASSWORD || 'routine_pass',
  database: process.env.DB_NAME || 'routine_db',
  entities: ['src/entities/**/*.entity.ts'],
  migrations: ['src/migrations/**/*.ts'],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  dropSchema: false,
};
```

### Step 6: Database Module

Create `src/database/database.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ormConfig } from '../../ormconfig';

@Module({
  imports: [TypeOrmModule.forRoot(ormConfig)],
})
export class DatabaseModule {}
```

### Step 7: Update App Module

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { SemestersModule } from './modules/semesters/semesters.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { SectionsModule } from './modules/sections/sections.module';
import { CoursesModule } from './modules/courses/courses.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { DaysModule } from './modules/days/days.module';
import { ClassSlotsModule } from './modules/class-slots/class-slots.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    SemestersModule,
    TeachersModule,
    RoomsModule,
    SectionsModule,
    CoursesModule,
    PeriodsModule,
    DaysModule,
    ClassSlotsModule,
    AssignmentsModule,
  ],
})
export class AppModule {}
```

### Step 8: Run Migrations

```bash
npm run typeorm migration:generate -- -n init
npm run typeorm migration:run
```

### Step 9: Start Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3201/api`

---

## Implementation Guide

### 1. Module Structure (Example: Teachers Module)

Create `src/modules/teachers/teachers.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Teacher } from '../../entities/teacher.entity';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Teacher])],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
```

### 2. Service Layer

Create `src/modules/teachers/teachers.service.ts`:
```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  async findAll(page = 1, limit = 20): Promise<{ data: Teacher[]; total: number; pages: number }> {
    const [data, total] = await this.teacherRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { data, total, pages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<Teacher> {
    const teacher = await this.teacherRepository.findOne({ where: { id } });
    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }
    return teacher;
  }

  async create(dto: CreateTeacherDto): Promise<Teacher> {
    const existing = await this.teacherRepository.findOne({
      where: { short_name: dto.short_name },
    });
    if (existing) {
      throw new BadRequestException(`Teacher with short_name ${dto.short_name} already exists`);
    }
    return this.teacherRepository.save(dto);
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<Teacher> {
    const teacher = await this.findById(id);
    
    // Check short_name uniqueness if updating
    if (dto.short_name && dto.short_name !== teacher.short_name) {
      const existing = await this.teacherRepository.findOne({
        where: { short_name: dto.short_name },
      });
      if (existing) {
        throw new BadRequestException(`Teacher with short_name ${dto.short_name} already exists`);
      }
    }
    
    return this.teacherRepository.save({ ...teacher, ...dto });
  }

  async delete(id: string): Promise<void> {
    const teacher = await this.findById(id);
    await this.teacherRepository.remove(teacher);
  }

  async moveAssignments(fromId: string, toId: string): Promise<void> {
    // This will be handled in the assignments service
    // It updates all assignments that reference fromId to toId
  }
}
```

### 3. Controller Layer

Create `src/modules/teachers/teachers.controller.ts`:
```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from '../../dtos/create-teacher.dto';
import { UpdateTeacherDto } from '../../dtos/update-teacher.dto';

@Controller('api/teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  async findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.teachersService.findAll(page, limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.teachersService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateTeacherDto) {
    return this.teachersService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachersService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.teachersService.delete(id);
    return { success: true };
  }
}
```

### 4. DTOs

Create `src/dtos/create-teacher.dto.ts`:
```typescript
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
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

Create `src/dtos/update-teacher.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateTeacherDto } from './create-teacher.dto';

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}
```

### 5. Conflict Detection Service

Create `src/modules/class-slots/conflicts.service.ts`:
```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { CheckConflictsDto } from '../../dtos/check-conflicts.dto';

interface Conflict {
  type: string;
  message: string;
}

@Injectable()
export class ConflictsService {
  constructor(
    @InjectRepository(ClassSlot)
    private classSlotRepository: Repository<ClassSlot>,
    @InjectRepository(Course)
    private courseRepository: Repository<Course>,
    @InjectRepository(Section)
    private sectionRepository: Repository<Section>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(CourseSectionTeacher)
    private cstRepository: Repository<CourseSectionTeacher>,
  ) {}

  async checkConflicts(dto: CheckConflictsDto): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const course = await this.courseRepository.findOne({ where: { id: dto.course_id } });
    const section = await this.sectionRepository.findOne({ where: { id: dto.section_id } });

    if (!course || !section) {
      throw new BadRequestException('Invalid course or section');
    }

    // Check room capacity
    if (dto.candidate.room_id) {
      const room = await this.roomRepository.findOne({ where: { id: dto.candidate.room_id } });
      if (room && room.capacity < section.total_students) {
        conflicts.push({
          type: 'room_capacity',
          message: `Room ${room.name} capacity (${room.capacity}) < section students (${section.total_students})`,
        });
      }
    }

    // Check room double booking
    if (dto.candidate.room_id) {
      const overlapping = await this.classSlotRepository.find({
        where: {
          semester_id: dto.semester_id,
          room_id: dto.candidate.room_id,
          day: dto.candidate.day,
        },
      });

      for (const slot of overlapping) {
        if (slot.id !== dto.ignoreSlotId && this.timesOverlap(slot, dto.candidate)) {
          conflicts.push({
            type: 'room_double',
            message: `Room already booked for this time slot`,
          });
        }
      }
    }

    // Check teacher conflicts
    const cst = await this.cstRepository.findOne({
      where: {
        semester_id: dto.semester_id,
        course_id: dto.course_id,
        section_id: dto.section_id,
      },
    });

    if (cst && cst.teacher_ids.length > 0) {
      const teacherConflicts = await this.checkTeacherConflicts(
        cst.teacher_ids,
        dto.semester_id,
        dto.candidate,
        dto.ignoreSlotId,
      );
      conflicts.push(...teacherConflicts);
    }

    return conflicts;
  }

  private async checkTeacherConflicts(
    teacherIds: string[],
    semesterId: string,
    candidate: any,
    ignoreSlotId?: string,
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    for (const teacherId of teacherIds) {
      const teacherSlots = await this.classSlotRepository.find({
        where: { semester_id: semesterId, day: candidate.day },
      });

      const conflict = teacherSlots.some(
        (slot) =>
          slot.id !== ignoreSlotId &&
          this.timesOverlap(slot, candidate) &&
          this.weeksOverlap(slot.week, candidate.week),
      );

      if (conflict) {
        conflicts.push({
          type: 'teacher_double',
          message: `Teacher has conflicting class at this time`,
        });
      }
    }

    return conflicts;
  }

  private timesOverlap(slot1: any, slot2: any): boolean {
    const s1Start = this.timeToMinutes(slot1.start);
    const s1End = this.timeToMinutes(slot1.end);
    const s2Start = this.timeToMinutes(slot2.start);
    const s2End = this.timeToMinutes(slot2.end);

    return s1Start < s2End && s2Start < s1End;
  }

  private weeksOverlap(week1: string, week2: string): boolean {
    if (week1 === 'EVERY' || week2 === 'EVERY') return true;
    return week1 === week2;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
```

### 6. Seed Data Service

Create `src/modules/seed/seed.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from '../../entities/teacher.entity';
import { Room } from '../../entities/room.entity';
import { Section } from '../../entities/section.entity';
import { Course } from '../../entities/course.entity';
import { Period } from '../../entities/period.entity';
import { Day } from '../../entities/day.entity';
import * as seedData from '../../data/seed.json';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
    @InjectRepository(Room) private roomRepo: Repository<Room>,
    @InjectRepository(Section) private sectionRepo: Repository<Section>,
    @InjectRepository(Course) private courseRepo: Repository<Course>,
    @InjectRepository(Period) private periodRepo: Repository<Period>,
    @InjectRepository(Day) private dayRepo: Repository<Day>,
  ) {}

  async seed(): Promise<void> {
    // Clear existing data
    await this.teacherRepo.clear();
    await this.roomRepo.clear();
    await this.sectionRepo.clear();
    await this.courseRepo.clear();
    await this.periodRepo.clear();
    await this.dayRepo.clear();

    // Seed teachers
    await this.teacherRepo.insert(seedData.teachers);

    // Seed rooms
    await this.roomRepo.insert(seedData.rooms);

    // Seed sections
    await this.sectionRepo.insert(seedData.sections);

    // Seed courses
    await this.courseRepo.insert(seedData.courses);

    // Seed periods
    await this.periodRepo.insert(seedData.periods);

    // Seed days
    await this.dayRepo.insert(seedData.days);

    console.log('✅ Database seeded successfully');
  }
}
```

---

## Migration Strategy

### Phase 1: Backend Setup (1-2 weeks)
1. Set up NestJS project structure
2. Configure PostgreSQL and TypeORM
3. Implement database schema and entities
4. Build core CRUD endpoints for all resources
5. Implement validation and error handling

### Phase 2: Core Features (2-3 weeks)
1. Implement conflict detection logic
2. Implement assignment management
3. Build routine/schedule view endpoints
4. Add semester management
5. Create seed data endpoints

### Phase 3: Data Migration (1 week)
1. Create migration scripts to load seed.json
2. Migrate existing data from localStorage to PostgreSQL
3. Validate data integrity
4. Create backup procedures

### Phase 4: Frontend Integration (1-2 weeks)
1. Update frontend to use backend API instead of localStorage
2. Add authentication (JWT) if needed
3. Update API client
4. Test end-to-end workflows

### Phase 5: Testing & Deployment (1-2 weeks)
1. Write unit tests for services
2. Write integration tests for endpoints
3. Performance testing and optimization
4. Deploy to staging environment
5. Production deployment

---

## Next Steps

1. **Copy the seed.json file** to `src/data/seed.json` in the backend project
2. **Create DTOs** for all entity models
3. **Implement repositories** for data access
4. **Build controllers** for each module
5. **Add comprehensive validation** and error handling
6. **Write tests** (unit and integration)
7. **Document API** with Swagger/OpenAPI
8. **Set up CI/CD pipeline** for automated deployments

For questions or clarifications, refer back to the frontend code structure at [src/lib/types.ts](src/lib/types.ts) and [src/lib/store.ts](src/lib/store.ts).
