import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CTSetting } from '../../entities/ct-setting.entity';
import { CTWeekConfig } from '../../entities/ct-week-config.entity';
import { CTAssignment } from '../../entities/ct-assignment.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { Room } from '../../entities/room.entity';
import { Course } from '../../entities/course.entity';
import { UpdateCTSettingDto, UpdateCTWeekConfigsDto, UpdateCTAssignmentDto } from '../../dtos/ct-schedule.dto';

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
    if (!semesterId || semesterId === 'undefined') {
      throw new ConflictException('Invalid semester ID');
    }
    let settings = await this.ctSettingRepository.findOne({ where: { semester_id: semesterId } });
    if (!settings) {
      settings = this.ctSettingRepository.create({
        semester_id: semesterId,
        total_weeks: 14,
        start_week: 4,
      });
      await this.ctSettingRepository.save(settings);
    }
    return settings;
  }

  async updateSettings(semesterId: string, dto: UpdateCTSettingDto) {
    if (!semesterId || semesterId === 'undefined') {
      throw new ConflictException('Invalid semester ID');
    }
    let settings = await this.getSettings(semesterId);
    settings.total_weeks = dto.total_weeks;
    settings.start_week = dto.start_week;
    if (dto.start_date) {
      // Ensure date is stored without time/timezone issues by using string part
      settings.start_date = new Date(dto.start_date.split('T')[0]);
    }
    return this.ctSettingRepository.save(settings);
  }

  async getWeekConfigs(semesterId: string) {
    if (!semesterId || semesterId === 'undefined') return [];
    return this.ctWeekConfigRepository.find({
      where: { semester_id: semesterId },
      order: { week_number: 'ASC', date: 'ASC' },
    });
  }

  async updateWeekConfigs(semesterId: string, dto: UpdateCTWeekConfigsDto) {
    if (!semesterId || semesterId === 'undefined') {
      throw new ConflictException('Invalid semester ID');
    }
    for (const config of dto.configs) {
      const dateOnly = new Date(config.date.split('T')[0]);
      let existing = await this.ctWeekConfigRepository.findOne({
        where: {
          semester_id: semesterId,
          week_number: config.week_number,
          date: dateOnly,
        },
      });

      if (existing) {
        existing.is_available = config.is_available;
        await this.ctWeekConfigRepository.save(existing);
      } else {
        const newConfig = this.ctWeekConfigRepository.create({
          semester_id: semesterId,
          week_number: config.week_number,
          date: dateOnly,
          is_available: config.is_available,
        });
        await this.ctWeekConfigRepository.save(newConfig);
      }
    }
    return this.getWeekConfigs(semesterId);
  }

  async getAssignments(semesterId: string) {
    if (!semesterId || semesterId === 'undefined') return [];
    return this.ctAssignmentRepository.find({
      where: { semester_id: semesterId },
      relations: ['course', 'section', 'room'],
      order: { date: 'ASC' },
    });
  }

  async generateSchedule(semesterId: string) {
    if (!semesterId || semesterId === 'undefined') {
      throw new ConflictException('Invalid semester ID');
    }

    const settings = await this.getSettings(semesterId);

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

    // Filter to ensure Non-Departmental courses only get assignments for ONE section (Common CT)
    const processedCsts: CourseSectionTeacher[] = [];
    const nonDeptCourseIds = new Set<string>();

    for (const cst of theoryCsts) {
      if (cst.course.departmental_type === 'Non-Departmental') {
        if (!nonDeptCourseIds.has(cst.course_id)) {
          processedCsts.push(cst);
          nonDeptCourseIds.add(cst.course_id);
        }
      } else {
        processedCsts.push(cst);
      }
    }

    // 3. Get all available CT slots (weeks/days) starting from settings.start_week
    const availableConfigs = await this.ctWeekConfigRepository.find({
      where: {
        semester_id: semesterId,
        is_available: true,
      },
      order: { week_number: 'ASC', date: 'ASC' },
    });

    const filteredSlots = availableConfigs.filter(slot => slot.week_number >= settings.start_week);

    if (filteredSlots.length === 0) {
      throw new ConflictException(`No available CT weeks/days configured from week ${settings.start_week}.`);
    }

    // 4. Get all rooms (Theory + Sessional)
    const allRooms = await this.roomRepository.find();

    // 5. Plan assignments - group by level-term, all sections' same CT on same date
    const assignments: Partial<CTAssignment>[] = [];

    // Keep track of bookings: date -> room_id -> boolean
    const roomBookings: Record<string, Set<string>> = {};

    // Group CSTs by level-term-department
    const groupedByLevelTerm: Record<string, CourseSectionTeacher[]> = {};
    for (const cst of processedCsts) {
      const key = `${cst.course.level}-${cst.course.term}-${cst.course.departmental_type}-${cst.course.department_id || 'none'}`;
      if (!groupedByLevelTerm[key]) groupedByLevelTerm[key] = [];
      groupedByLevelTerm[key].push(cst);
    }

    // Process each level-term group separately
    for (const levelTermKey of Object.keys(groupedByLevelTerm)) {
      const cstForLevelTerm = groupedByLevelTerm[levelTermKey];

      // Find max CT count for this level-term
      const maxCtCount = Math.max(...cstForLevelTerm.map(c => c.course.credit >= 3 ? 3 : 2), 1);

      // For each CT number (1, 2, 3...), assign ALL SECTIONS of this level-term to the SAME date
      for (let ctNum = 1; ctNum <= maxCtCount; ctNum++) {
        // Get all CSTs that have this CT number for this level-term
        const cstForThisCt = cstForLevelTerm.filter(cst => {
          const ctCount = cst.course.credit >= 3 ? 3 : 2;
          return ctNum <= ctCount;
        });

        if (cstForThisCt.length === 0) continue;

        // Find a date for this CT number
        let selectedDate: Date | null = null;
        let selectedSlot: typeof filteredSlots[0] | null = null;

        // Try to find slot with enough rooms
        for (const slot of filteredSlots) {
          const dateStr = slot.date instanceof Date ? slot.date.toISOString().split('T')[0] : (slot.date as string);

          if (!roomBookings[dateStr]) roomBookings[dateStr] = new Set();

          // Check if too close to other CTs of same course
          let isTooClose = false;
          for (const cst of cstForThisCt) {
            const sameCourseAssignments = assignments.filter(a => a.course_id === cst.course_id && a.section_id === cst.section_id);
            if (sameCourseAssignments.some(a => Math.abs(a.week_number - slot.week_number) < 2)) {
              isTooClose = true;
              break;
            }
          }
          if (isTooClose) continue;

          // Check if enough rooms available for all CSTs on this date
          const availableRooms = allRooms.filter(r => !roomBookings[dateStr].has(r.id));
          if (availableRooms.length >= cstForThisCt.length) {
            selectedDate = slot.date;
            selectedSlot = slot;
            break;
          }
        }

        // If no date found with space constraint, try without it
        if (!selectedDate) {
          for (const slot of filteredSlots) {
            const dateStr = slot.date instanceof Date ? slot.date.toISOString().split('T')[0] : (slot.date as string);

            if (!roomBookings[dateStr]) roomBookings[dateStr] = new Set();

            // Check distance constraint
            let isTooClose = false;
            for (const cst of cstForThisCt) {
              const sameCourseAssignments = assignments.filter(a => a.course_id === cst.course_id && a.section_id === cst.section_id);
              if (sameCourseAssignments.some(a => Math.abs(a.week_number - slot.week_number) < 2)) {
                isTooClose = true;
                break;
              }
            }
            if (isTooClose) continue;

            const availableRooms = allRooms.filter(r => !roomBookings[dateStr].has(r.id));
            if (availableRooms.length >= cstForThisCt.length) {
              selectedDate = slot.date;
              selectedSlot = slot;
              break;
            }
          }
        }

        // If still no date, just find any slot
        if (!selectedDate) {
          for (const slot of filteredSlots) {
            const dateStr = slot.date instanceof Date ? slot.date.toISOString().split('T')[0] : (slot.date as string);
            if (!roomBookings[dateStr]) roomBookings[dateStr] = new Set();

            selectedDate = slot.date;
            selectedSlot = slot;
            break;
          }
        }

        // Assign all CSTs of this level-term this CT to the selected date
        if (selectedDate && selectedSlot) {
          const dateStr = selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : (selectedDate as string);

          if (!roomBookings[dateStr]) roomBookings[dateStr] = new Set();

          const availableRooms = allRooms.filter(r => !roomBookings[dateStr].has(r.id));

          for (const cst of cstForThisCt) {
            let selectedRoom = null;
            if (availableRooms.length > 0) {
              selectedRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
            } else {
              // If no rooms available, pick any room (will have conflict but assignment will be made)
              selectedRoom = allRooms[Math.floor(Math.random() * allRooms.length)];
            }

            assignments.push({
              semester_id: semesterId,
              course_id: cst.course_id,
              section_id: cst.section_id,
              room_id: selectedRoom.id,
              week_number: selectedSlot.week_number,
              date: selectedDate,
              ct_number: ctNum,
            });

            roomBookings[dateStr].add(selectedRoom.id);
          }
        }
      }
    }

    // 7. Save assignments
    await this.ctAssignmentRepository.save(this.ctAssignmentRepository.create(assignments));

    return this.getAssignments(semesterId);
  }

  async updateAssignment(id: string, dto: UpdateCTAssignmentDto) {
    const assignment = await this.ctAssignmentRepository.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    if (dto.room_id && dto.date) {
      const dateOnly = new Date(dto.date.split('T')[0]);
      const collision = await this.ctAssignmentRepository.findOne({
        where: {
          semester_id: assignment.semester_id,
          room_id: dto.room_id,
          date: dateOnly,
        },
      });
      if (collision && collision.id !== id) {
        throw new ConflictException('Another CT is already scheduled in this room on this date');
      }
    }

    if (dto.room_id) assignment.room_id = dto.room_id;
    if (dto.week_number) assignment.week_number = dto.week_number;
    if (dto.date) assignment.date = new Date(dto.date.split('T')[0]);

    return this.ctAssignmentRepository.save(assignment);
  }
}

