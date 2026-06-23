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
    let availableConfigs = await this.ctWeekConfigRepository.find({
      where: {
        semester_id: semesterId,
        is_available: true,
      },
      order: { week_number: 'ASC', date: 'ASC' },
    });

    let filteredSlots = availableConfigs.filter(slot => slot.week_number >= settings.start_week);

    // If no slots configured, auto-generate them for the configured weeks
    if (filteredSlots.length === 0) {
      console.log('No available CT slots found. Auto-generating slots...');

      // Generate slots for each week from start_week to total_weeks
      const autoGeneratedSlots: Partial<CTWeekConfig>[] = [];
      const testDays = [0, 1, 2, 3, 4]; // Sunday to Thursday

      for (let week = settings.start_week; week <= settings.total_weeks; week++) {
        for (const dayOffset of testDays) {
          if (settings.start_date) {
            const startDate = new Date(settings.start_date);
            const daysFromStart = (week - 1) * 7 + dayOffset;
            const slotDate = new Date(startDate);
            slotDate.setDate(slotDate.getDate() + daysFromStart);

            autoGeneratedSlots.push({
              semester_id: semesterId,
              week_number: week,
              date: slotDate,
              is_available: true,
            });
          }
        }
      }

      if (autoGeneratedSlots.length > 0) {
        await this.ctWeekConfigRepository.save(
          autoGeneratedSlots.map(s => this.ctWeekConfigRepository.create(s))
        );
        filteredSlots = autoGeneratedSlots as CTWeekConfig[];
      } else {
        throw new ConflictException(
          `Cannot generate CT schedule. Please configure available weeks/days in CT Configuration. ` +
          `Set start date and available days for weeks ${settings.start_week} to ${settings.total_weeks}.`
        );
      }
    }

    // 4. Get rooms - filter by department and type
    const allRooms = await this.roomRepository.find({ relations: ['department'] });

    // First, get CSE department ID (or the primary departmental rooms)
    const cseRooms = allRooms.filter(r =>
      r.room_type === 'Theory' || r.room_type === 'Both'
    );

    const availableRooms = cseRooms.length > 0 ? cseRooms : allRooms;

    if (availableRooms.length === 0) {
      throw new ConflictException('No suitable rooms available for CT scheduling.');
    }

    // 5. Plan assignments - distribute CTs across entire date range
    const assignments: Partial<CTAssignment>[] = [];

    // Group CSTs by level-term-department
    const groupedByLevelTerm: Record<string, CourseSectionTeacher[]> = {};
    for (const cst of processedCsts) {
      const key = `${cst.course.level}-${cst.course.term}-${cst.course.departmental_type}-${cst.course.department_id || 'none'}`;
      if (!groupedByLevelTerm[key]) groupedByLevelTerm[key] = [];
      groupedByLevelTerm[key].push(cst);
    }

    // Group by course instead of level-term
    const groupedByCourse: Record<string, CourseSectionTeacher[]> = {};
    for (const cst of processedCsts) {
      const courseId = cst.course_id;
      if (!groupedByCourse[courseId]) groupedByCourse[courseId] = [];
      groupedByCourse[courseId].push(cst);
    }

    // Calculate spacing for distribution across semester
    const courseIds = Object.keys(groupedByCourse);
    const totalCourses = courseIds.length;
    const maxCtCount = Math.max(
      ...courseIds.map(cId =>
        Math.max(...groupedByCourse[cId].map(c => c.course.credit >= 3 ? 3 : 2), 1)
      ),
      1
    );

    // Calculate slot step to spread courses across semester
    const slotStepPerCourse = Math.max(1, Math.floor(filteredSlots.length / Math.max(1, totalCourses * maxCtCount)));
    let currentSlotIndex = 0;

    // IMPORTANT: For each COURSE, generate CT1, then CT2, then CT3
    for (const courseId of courseIds) {
      const courseCSTs = groupedByCourse[courseId];
      const courseMaxCtCount = Math.max(...courseCSTs.map(c => c.course.credit >= 3 ? 3 : 2), 1);

      // For this course, process CT numbers in order (CT1, then CT2, then CT3)
      for (let ctNum = 1; ctNum <= courseMaxCtCount; ctNum++) {
        // Get all sections of this course that have this CT number
        const cstForThisCt = courseCSTs.filter(cst => {
          const ctCount = cst.course.credit >= 3 ? 3 : 2;
          return ctNum <= ctCount;
        });

        if (cstForThisCt.length === 0) continue;

        // Find an appropriate slot for this CT
        let slot = null;
        let slotIdx = currentSlotIndex % filteredSlots.length;
        let searchAttempts = 0;
        const maxSearchAttempts = filteredSlots.length;

        while (!slot && searchAttempts < maxSearchAttempts) {
          const candidateSlot = filteredSlots[slotIdx];

          // Check if this course section already has a CT too close to this slot
          let canUseSlot = true;
          for (const cst of cstForThisCt) {
            const sameCourseCTs = assignments.filter(
              a => a.course_id === cst.course_id && a.section_id === cst.section_id
            );
            if (sameCourseCTs.some(a => Math.abs(a.week_number - candidateSlot.week_number) < 2)) {
              canUseSlot = false;
              break;
            }
          }

          if (canUseSlot) {
            slot = candidateSlot;
            break;
          }

          slotIdx = (slotIdx + 1) % filteredSlots.length;
          searchAttempts++;
        }

        // Fallback: use current slot if search fails
        if (!slot && filteredSlots.length > 0) {
          slot = filteredSlots[currentSlotIndex % filteredSlots.length];
        }

        if (slot) {
          const dateStr = slot.date instanceof Date
            ? slot.date.toISOString().split('T')[0]
            : (slot.date as string);

          // Find available room(s) for this date
          const bookedRoomsOnDate = assignments
            .filter(a => {
              const aDate = a.date instanceof Date
                ? a.date.toISOString().split('T')[0]
                : (a.date as string);
              return aDate === dateStr;
            })
            .map(a => a.room_id);

          const availableRoomsOnDate = availableRooms.filter(r => !bookedRoomsOnDate.includes(r.id));
          const roomsToUse = availableRoomsOnDate.length > 0 ? availableRoomsOnDate : availableRooms;

          // Assign all sections of this course to this date with different rooms
          for (let i = 0; i < cstForThisCt.length; i++) {
            const cst = cstForThisCt[i];
            const selectedRoom = roomsToUse[i % roomsToUse.length];

            assignments.push({
              semester_id: semesterId,
              course_id: cst.course_id,
              section_id: cst.section_id,
              room_id: selectedRoom.id,
              week_number: slot.week_number,
              date: slot.date,
              ct_number: ctNum,
            });
          }

          // Move index forward for next CT of this course
          currentSlotIndex = (currentSlotIndex + slotStepPerCourse) % filteredSlots.length;
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

