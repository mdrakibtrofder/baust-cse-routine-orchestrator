# Routine Management System - NestJS Backend Quick Start

## 5-Minute Setup

### 1. Initialize Project
```bash
nest new routine-backend
cd routine-backend
npm install --save @nestjs/typeorm typeorm pg class-validator class-transformer @nestjs/config dotenv
```

### 2. Create `.env`
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=routine_user
DB_PASSWORD=routine_pass
DB_NAME=routine_db
NODE_ENV=development
APP_PORT=3000
```

### 3. Start PostgreSQL
```bash
docker run --name routine-db -e POSTGRES_USER=routine_user -e POSTGRES_PASSWORD=routine_pass -e POSTGRES_DB=routine_db -p 5432:5432 -d postgres:16-alpine
```

### 4. Create `ormconfig.ts`
```typescript
import { DataSourceOptions } from 'typeorm';

export const ormConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'routine_user',
  password: process.env.DB_PASSWORD || 'routine_pass',
  database: process.env.DB_NAME || 'routine_db',
  entities: ['src/entities/**/*.entity.ts'],
  migrations: ['src/migrations/**/*.ts'],
  synchronize: true, // Set to false in production
};
```

### 5. Create Database Module (`src/database/database.module.ts`)
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ormConfig } from '../../ormconfig';

@Module({
  imports: [TypeOrmModule.forRoot(ormConfig)],
})
export class DatabaseModule {}
```

### 6. Update `app.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
  ],
})
export class AppModule {}
```

### 7. Run
```bash
npm run start:dev
```

Server runs at `http://localhost:3000`

---

## Entity Quick Reference

### Teacher
- `id`: UUID (PK)
- `short_name`: VARCHAR (UNIQUE) - "JA", "MSA"
- `name`: VARCHAR - Full name
- `designation`: VARCHAR - "Professor", "Lecturer", etc.
- `department`: VARCHAR - "CSE", etc.
- `status`: VARCHAR - "Librarian", "HoD", etc.
- `assigned_credit`: NUMERIC(5,2) - Credit hours assigned

### Room
- `id`: UUID (PK)
- `name`: VARCHAR (UNIQUE) - "Room 101"
- `room_type`: VARCHAR - "Theory" or "Sessional"
- `capacity`: INTEGER - Number of students

### Section
- `id`: UUID (PK)
- `level`: INTEGER - 1-4 for CSE
- `term`: VARCHAR - "I" or "II"
- `name`: VARCHAR - "A", "B", "C"
- `total_students`: INTEGER

### Course
- `id`: UUID (PK)
- `code`: VARCHAR (UNIQUE) - "CSE101"
- `name`: VARCHAR - Full course name
- `credit`: NUMERIC(3,2) - Credit hours
- `course_type`: VARCHAR - "theory_2.0", "theory_3.0", "sessional_1.5", "sessional_0.75"
- `level`: INTEGER
- `term`: VARCHAR - "I" or "II"
- `theory`: INTEGER - Theory hours
- `sessional`: INTEGER - Sessional hours

### Period
- `id`: UUID (PK)
- `name`: VARCHAR - "Period 1", "Period 2", etc.
- `start`: TIME - "08:30"
- `end`: TIME - "09:30"
- `duration`: INTEGER - Minutes
- `kind`: VARCHAR - "theory" or "sessional"

### Day
- `id`: UUID (PK)
- `name`: VARCHAR (UNIQUE) - "Sunday", "Monday", etc.

### ClassSlot
- `id`: UUID (PK)
- `semester_id`: UUID (FK) - Reference to Semester
- `course_id`: UUID (FK) - Reference to Course
- `section_id`: UUID (FK) - Reference to Section
- `room_id`: UUID (FK, nullable) - Reference to Room
- `day`: VARCHAR - "Sunday", etc.
- `start`: TIME - "08:30"
- `end`: TIME - "09:30"
- `week`: VARCHAR - "EVERY", "EVEN", "ODD"

### CourseSectionTeacher
- `id`: UUID (PK)
- `semester_id`: UUID (FK)
- `course_id`: UUID (FK)
- `section_id`: UUID (FK)
- `teacher_ids`: UUID[] - PostgreSQL ARRAY type

### Semester
- `id`: UUID (PK)
- `name`: VARCHAR - "Winter 2026"
- `year`: INTEGER
- `season`: VARCHAR - "Winter" or "Summer"

---

## Common Service Methods Template

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class BaseService<T> {
  constructor(
    @InjectRepository(Entity) // Replace with actual entity
    private readonly repository: Repository<T>,
  ) {}

  async findAll(page = 1, limit = 1000) {
    const [data, total] = await this.repository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { data, total, pages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<T> {
    const entity = await this.repository.findOne({ where: { id } as any });
    if (!entity) throw new NotFoundException(`Entity with ID ${id} not found`);
    return entity;
  }

  async create(dto: any): Promise<T> {
    return this.repository.save(dto);
  }

  async update(id: string, dto: any): Promise<T> {
    const entity = await this.findById(id);
    return this.repository.save({ ...entity, ...dto });
  }

  async delete(id: string): Promise<void> {
    const entity = await this.findById(id);
    await this.repository.remove(entity);
  }
}
```

---

## API Response Formats

### Success Response (200)
```json
{
  "id": "uuid-here",
  "name": "Example",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

### Paginated Response (200)
```json
{
  "data": [ /* ... */ ],
  "total": 50,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

### Validation Error (400)
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "name": ["name must be a string"],
    "capacity": ["capacity must be a positive number"]
  }
}
```

### Not Found (404)
```json
{
  "statusCode": 404,
  "message": "Entity with ID xxx not found"
}
```

### Conflict (409)
```json
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
```

---

## Key Business Rules

### Course Type Classification
| Type | Credit | Theory Classes | Sessional | Teachers | Room Type | Week |
|------|--------|----------------|-----------|----------|-----------|------|
| `theory_2.0` | 2.0 | 2 | 0 | 1 | Theory | EVERY |
| `theory_3.0` | 3.0 | 3 | 0 | 1 | Theory | EVERY |
| `sessional_1.5` | 1.5 | 0 | 1 | 2 | Sessional | EVERY |
| `sessional_0.75` | 0.75 | 0 | 1 | 2 | Sessional | EVEN |

### Conflict Types
- `room_capacity`: Room capacity < section students
- `room_type`: Room type mismatch (needs Theory but got Sessional)
- `room_double`: Room already booked
- `teacher_double`: Teacher already has class at this time
- `section_double`: Section already has class at this time
- `teacher_credit`: Teacher credit limit exceeded

### Week Patterns
- `EVERY`: Class meets every week
- `EVEN`: Class meets on even weeks (2, 4, 6, ...)
- `ODD`: Class meets on odd weeks (1, 3, 5, ...)

---

## Debugging Tips

### Check Database Connection
```typescript
// In app.module.ts or any service
import { getConnection } from 'typeorm';

// Test query
const result = await getConnection().query('SELECT NOW()');
console.log('Database connected:', result);
```

### View Generated SQL
Set `logging: true` in `ormconfig.ts` to see all SQL queries in console.

### Test an Endpoint
```bash
curl -X GET http://localhost:3000/api/teachers \
  -H "Content-Type: application/json"
```

### Check TypeORM Migrations
```bash
npm run typeorm migration:show
npm run typeorm migration:generate -- -n MigrationName
npm run typeorm migration:run
npm run typeorm migration:revert
```

---

## Common Packages & Versions

```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/typeorm": "^9.0.0",
  "@nestjs/config": "^3.0.0",
  "typeorm": "^0.3.17",
  "pg": "^8.11.2",
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.1",
  "dotenv": "^16.3.1"
}
```

---

## Files to Create for Each Module

For a new module like `CoursesModule`:

```
src/modules/courses/
├── courses.module.ts
├── courses.service.ts
├── courses.controller.ts
├── courses.repository.ts (optional)
```

Minimal `courses.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../../entities/course.entity';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Course])],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
```

---

## Frontend Integration Points

### Before (Using localStorage)
```typescript
import { useStore } from '@/lib/store';
const data = useStore(); // Zustand store with seed.json
```

### After (Using Backend)
```typescript
// Create axios instance
const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Fetch teachers
const response = await apiClient.get('/teachers');
const teachers = response.data.data;
```

---

## Production Checklist

- [ ] Set `synchronize: false` in TypeORM config
- [ ] Use environment-specific configs
- [ ] Implement proper error logging
- [ ] Add request/response validation
- [ ] Enable CORS if frontend is on different domain
- [ ] Implement rate limiting
- [ ] Add JWT authentication
- [ ] Create database backups
- [ ] Set up monitoring and alerts
- [ ] Use secrets manager for sensitive data
- [ ] Implement API versioning (/api/v1/)
- [ ] Write comprehensive tests
- [ ] Document with Swagger/OpenAPI

---

## Support

For detailed documentation, refer to:
- [BACKEND_DOCUMENTATION.md](./BACKEND_DOCUMENTATION.md) - Main documentation
- [NestJS Docs](https://docs.nestjs.com)
- [TypeORM Docs](https://typeorm.io)
- [PostgreSQL Docs](https://www.postgresql.org/docs)
