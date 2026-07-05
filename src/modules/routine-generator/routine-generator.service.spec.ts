import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutineGeneratorService } from './routine-generator.service';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { Period } from '../../entities/period.entity';
import { Day } from '../../entities/day.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { CourseLabSection } from '../../entities/course-lab-section.entity';
import { Department } from '../../entities/department.entity';
import { TeacherUnavailability } from '../../entities/teacher-unavailability.entity';
import { RoomUnavailability } from '../../entities/room-unavailability.entity';
import { PriorityClass } from '../../entities/priority-class.entity';

describe('RoutineGeneratorService', () => {
  let service: RoutineGeneratorService;

  const mockRepository = () => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    }),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutineGeneratorService,
        { provide: getRepositoryToken(ClassSlot), useFactory: mockRepository },
        { provide: getRepositoryToken(Course), useFactory: mockRepository },
        { provide: getRepositoryToken(Section), useFactory: mockRepository },
        { provide: getRepositoryToken(Room), useFactory: mockRepository },
        { provide: getRepositoryToken(Period), useFactory: mockRepository },
        { provide: getRepositoryToken(Day), useFactory: mockRepository },
        { provide: getRepositoryToken(CourseSectionTeacher), useFactory: mockRepository },
        { provide: getRepositoryToken(CourseLabSection), useFactory: mockRepository },
        { provide: getRepositoryToken(Department), useFactory: mockRepository },
        { provide: getRepositoryToken(TeacherUnavailability), useFactory: mockRepository },
        { provide: getRepositoryToken(RoomUnavailability), useFactory: mockRepository },
        { provide: getRepositoryToken(PriorityClass), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<RoutineGeneratorService>(RoutineGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have initial status as IDLE', () => {
    expect(service.getProgress().status).toBe('IDLE');
  });
});
