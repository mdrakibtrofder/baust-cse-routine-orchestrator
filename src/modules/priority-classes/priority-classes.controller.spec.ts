import { Test, TestingModule } from '@nestjs/testing';
import { PriorityClassesController } from './priority-classes.controller';
import { PriorityClassesService } from './priority-classes.service';

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

describe('PriorityClassesController', () => {
  let controller: PriorityClassesController;
  let service: PriorityClassesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PriorityClassesController],
      providers: [
        {
          provide: PriorityClassesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([mockPriorityClass]),
            findById: jest.fn().mockResolvedValue(mockPriorityClass),
            create: jest.fn().mockResolvedValue(mockPriorityClass),
            update: jest.fn().mockResolvedValue(mockPriorityClass),
            delete: jest.fn().mockResolvedValue({ success: true }),
          },
        },
      ],
    }).compile();

    controller = module.get<PriorityClassesController>(PriorityClassesController);
    service = module.get<PriorityClassesService>(PriorityClassesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all priority classes', async () => {
      const result = await controller.findAll();
      expect(result).toEqual([mockPriorityClass]);
      expect(service.findAll).toHaveBeenCalled();
    });

    it('should pass semester_id query param to service', async () => {
      const result = await controller.findAll('semester-id');
      expect(result).toEqual([mockPriorityClass]);
      expect(service.findAll).toHaveBeenCalledWith('semester-id');
    });
  });

  describe('findOne', () => {
    it('should return a priority class by id', async () => {
      const result = await controller.findOne('priority-id-1');
      expect(result).toEqual(mockPriorityClass);
      expect(service.findById).toHaveBeenCalledWith('priority-id-1');
    });
  });

  describe('create', () => {
    it('should create priority class', async () => {
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
      const result = await controller.create(dto);
      expect(result).toEqual(mockPriorityClass);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should update priority class', async () => {
      const dto = { level: 2 };
      const result = await controller.update('priority-id-1', dto);
      expect(result).toEqual(mockPriorityClass);
      expect(service.update).toHaveBeenCalledWith('priority-id-1', dto);
    });
  });

  describe('remove', () => {
    it('should delete priority class', async () => {
      const result = await controller.remove('priority-id-1');
      expect(result).toEqual({ success: true });
      expect(service.delete).toHaveBeenCalledWith('priority-id-1');
    });
  });
});
