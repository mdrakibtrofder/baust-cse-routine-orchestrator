import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TeachersService } from './teachers.service';
import { Teacher } from '../../entities/teacher.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { TeacherUnavailability } from '../../entities/teacher-unavailability.entity';

describe('TeachersService', () => {
  let service: TeachersService;
  let teacherRepo: any;
  let cstRepo: any;
  let unavailabilityRepo: any;

  const mockTeacher = { id: 't1', short_name: 'T1', name: 'Teacher 1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeachersService,
        {
          provide: getRepositoryToken(Teacher),
          useValue: {
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CourseSectionTeacher),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(TeacherUnavailability),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) => cb({
              remove: jest.fn(),
              save: jest.fn(),
              create: jest.fn(),
            })),
          },
        },
      ],
    }).compile();

    service = module.get<TeachersService>(TeachersService);
    teacherRepo = module.get(getRepositoryToken(Teacher));
    cstRepo = module.get(getRepositoryToken(CourseSectionTeacher));
    unavailabilityRepo = module.get(getRepositoryToken(TeacherUnavailability));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('delete', () => {
    it('should throw NotFoundException if teacher does not exist', async () => {
      teacherRepo.findOne.mockResolvedValue(null);
      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if teacher has assignments', async () => {
      teacherRepo.findOne.mockResolvedValue(mockTeacher);
      
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'assignment1' }]),
      };
      cstRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await expect(service.delete('t1')).rejects.toThrow(ConflictException);
      expect(cstRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should delete teacher if no assignments exist', async () => {
      teacherRepo.findOne.mockResolvedValue(mockTeacher);
      
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      cstRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      unavailabilityRepo.find.mockResolvedValue([]);

      await service.delete('t1');
      expect(teacherRepo.findOne).toHaveBeenCalledWith({ where: { id: 't1' } });
    });
  });
});
