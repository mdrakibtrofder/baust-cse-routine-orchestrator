import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CTSetting } from '../../entities/ct-setting.entity';
import { CTWeekConfig } from '../../entities/ct-week-config.entity';
import { CTAssignment } from '../../entities/ct-assignment.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { Room } from '../../entities/room.entity';
import { Course } from '../../entities/course.entity';
import { UpdateCTSettingDto, UpdateCTWeekConfigsDto } from '../../dtos/ct-schedule.dto';

@Injectable()
export class CTScheduleService {
  constructor(
    @InjectRepository(CTSetting)
    private readonly ctSettingRepository: Repository<CTSetting>,
    @InjectRepository(CTWeekConfig)
    private readonly ctWeekConfigRepository: Repository<CTWeekConfig>,
    @InjectRepository(CTAssignment)
    private readonly ctAssignmentRepository: Repository<CTAssignment>,
    @InjectRepository(CourseSectionTeacher)
    private readonly cstRepository: Repository<CourseSectionTeacher>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
  ) {}

  async getSettings(semesterId: string) {
    let settings = await this.ctSettingRepository.findOne({ where: { semester_id: semesterId } });
    if (!settings) {
      settings = this.ctSettingRepository.create({
        semester_id: semesterId,
        total_weeks: 14,
      });
      await this.ctSettingRepository.save(settings);
    }
    return settings;
  }

  async updateSettings(semesterId: string, dto: UpdateCTSettingDto) {
    let settings = await this.getSettings(semesterId);
    settings.total_weeks = dto.total_weeks;
    if (dto.start_date) {
      settings.start_date = new Date(dto.start_date);
    }
    return this.ctSettingRepository.save(settings);
  }

  async getWeekConfigs(semesterId: string) {
    return this.ctWeekConfigRepository.find({
      where: { semester_id: semesterId },
      order: { week_number: 'ASC', date: 'ASC' },
    });
  }

  async updateWeekConfigs(semesterId: string, dto: UpdateCTWeekConfigsDto) {
    // This is a bit complex as we might need to delete old ones or update existing
    // For simplicity, we can clear and recreate or do upsert
    // Let's do upsert
    for (const config of dto.configs) {
      let existing = await this.ctWeekConfigRepository.findOne({
        where: {
          semester_id: semesterId,
          week_number: config.week_number,
          date: new Date(config.date),
        },
      });

      if (existing) {
        existing.is_available = config.is_available;
        await this.ctWeekConfigRepository.save(existing);
      } else {
        const newConfig = this.ctWeekConfigRepository.create({
          semester_id: semesterId,
          week_number: config.week_number,
          date: new Date(config.date),
          is_available: config.is_available,
        });
        await this.ctWeekConfigRepository.save(newConfig);
      }
    }
    return this.getWeekConfigs(semesterId);
  }

  async getAssignments(semesterId: string) {
    return this.ctAssignmentRepository.find({
      where: { semester_id: semesterId },
      relations: ['course', 'section', 'room'],
      order: { date: 'ASC' },
    });
  }

  async generateSchedule(semesterId: string) {
    // 1. Clear existing assignments
    await this.ctAssignmentRepository.delete({ semester_id: semesterId });

    // 2. Get all theory courses offered in this semester
    const csts = await this.cstRepository.find({
      where: { semester_id: semesterId },
      relations: ['course', 'section'],
    });

    const theoryCsts = csts.filter(cst => 
      cst.course.course_type.startsWith('theory')
    );

    // 3. Get all available CT slots (weeks/days)
    const availableConfigs = await this.ctWeekConfigRepository.find({
      where: { semester_id: semesterId, is_available: true },
      order: { week_number: 'ASC', date: 'ASC' },
    });

    if (availableConfigs.length === 0) {
      throw new ConflictException('No available CT weeks/days configured.');
    }

    // 4. Get all rooms (Theory + Sessional)
    const allRooms = await this.roomRepository.find();

    // 5. Shuffle rooms and slots to introduce randomness
    const shuffledSlots = [...availableConfigs].sort(() => Math.random() - 0.5);
    
    // 6. Plan assignments
    const assignments: Partial<CTAssignment>[] = [];
    
    // Keep track of room bookings: date -> room_id -> boolean
    const roomBookings: Record<string, Set<string>> = {};
    // Keep track of section bookings: date -> section_id -> boolean
    const sectionBookings: Record<string, Set<string>> = {};

    for (const cst of theoryCsts) {
      const ctCount = cst.course.credit >= 3 ? 3 : 2;
      
      for (let ctNum = 1; ctNum <= ctCount; ctNum++) {
        let assigned = false;
        
        // Try to find a slot
        for (const slot of shuffledSlots) {
          const dateStr = slot.date instanceof Date ? slot.date.toISOString().split('T')[0] : (slot.date as string);
          
          if (!roomBookings[dateStr]) roomBookings[dateStr] = new Set();
          if (!sectionBookings[dateStr]) sectionBookings[dateStr] = new Set();

          // Check if section already has a CT on this day
          if (sectionBookings[dateStr].has(cst.section_id)) continue;

          // Find an available room
          const availableRoom = allRooms.find(r => !roomBookings[dateStr].has(r.id));
          
          if (availableRoom) {
            assignments.push({
              semester_id: semesterId,
              course_id: cst.course_id,
              section_id: cst.section_id,
              room_id: availableRoom.id,
              week_number: slot.week_number,
              date: slot.date,
              ct_number: ctNum,
            });
            
            roomBookings[dateStr].add(availableRoom.id);
            sectionBookings[dateStr].add(cst.section_id);
            assigned = true;
            break;
          }
        }

        if (!assigned) {
          // If we couldn't assign, we might need more slots or rooms
          // For now, we just log it or continue
          console.warn(`Could not assign CT ${ctNum} for course ${cst.course.code} Section ${cst.section.name}`);
        }
      }
    }

    // 7. Save assignments
    await this.ctAssignmentRepository.save(this.ctAssignmentRepository.create(assignments));
    
    return this.getAssignments(semesterId);
  }
}
