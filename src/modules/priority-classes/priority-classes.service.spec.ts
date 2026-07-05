import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriorityClassesService } from './priority-classes.service';
import { PriorityClass } from '../../entities/priority-class.entity';
import { NotFoundException } from '@nestjs/common';

const mockPriorityClass = {
  id: 'priority-id-1',
  semester_id: 'semester-id',
  department_id: 'dept-id',
  level: 1,
  term: 'I',
  section_id: 'section-id',
  course_type: 'Theory',
  course_ids: ['course-id-1'],
  room_ids: ['room-id-1'],
  time_slots: [{ start: '08:30', end: '09:30' }],
  days: ['SUN'],
};

describe('PriorityClassesService', () => {
  let service: PriorityClassesService;
  let repository: Repository<PriorityClass>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriorityClassesService,
        {
          provide: getRepositoryToken(PriorityClass),
          useValue: {
            find: jest.fn().mockResolvedValue([mockPriorityClass]),
            findOne: jest.fn().mockResolvedValue(mockPriorityClass),
            create: jest.fn().mockReturnValue(mockPriorityClass),
            save: jest.fn().mockResolvedValue(mockPriorityClass),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            remove: jest.fn().mockResolvedValue(mockPriorityClass),
          },
        },
      ],
    }).compile();

    service = module.get<PriorityClassesService>(PriorityClassesService);
    repository = module.get<Repository<PriorityClass>>(getRepositoryToken(PriorityClass));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all priority classes', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockPriorityClass]);
      expect(repository.find).toHaveBeenCalled();
    });

    it('should filter by semester_id', async () => {
      const result = await service.findAll('semester-id');
      expect(result).toEqual([mockPriorityClass]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { semester_id: 'semester-id' },
        relations: ['semester', 'department', 'section'],
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('findById', () => {
    it('should return a single priority class', async () => {
      const result = await service.findById('priority-id-1');
      expect(result).toEqual(mockPriorityClass);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'priority-id-1' },
        relations: ['semester', 'department', 'section'],
      });
    });

    it('should throw NotFoundException when priority class is not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);
      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return a priority class', async () => {
      const dto = {
        semester_id: 'semester-id',
        department_id: 'dept-id',
        level: 1,
        term: 'I',
        section_id: 'section-id',
        course_type: 'Theory' as const,
        course_ids: ['course-id-1'],
        room_ids: ['room-id-1'],
        time_slots: [{ start: '08:30', end: '09:30' }],
        days: ['SUN'],
      };
      const result = await service.create(dto);
      expect(result).toEqual(mockPriorityClass);
      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return the updated priority class', async () => {
      const dto = { level: 2 };
      const result = await service.update('priority-id-1', dto);
      expect(result).toEqual(mockPriorityClass);
      expect(repository.update).toHaveBeenCalledWith('priority-id-1', dto);
    });

    it('should throw NotFoundException if no rows are updated', async () => {
      jest.spyOn(repository, 'update').mockResolvedValueOnce({ affected: 0, raw: [], generatedMaps: [] });
      await expect(service.update('priority-id-2', { level: 2 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should remove the priority class', async () => {
      const result = await service.delete('priority-id-1');
      expect(result).toEqual({ success: true });
      expect(repository.remove).toHaveBeenCalledWith(mockPriorityClass);
    });
  });
});
