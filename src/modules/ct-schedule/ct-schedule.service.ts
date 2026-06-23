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

    // 4. Get all rooms with department info
    const allRooms = await this.roomRepository.find({ relations: ['department'] });

    if (allRooms.length === 0) {
      throw new ConflictException('No suitable rooms available for CT scheduling.');
    }

    // 5. Group by course
    const groupedByCourse: Record<string, CourseSectionTeacher[]> = {};
    for (const cst of processedCsts) {
      const courseId = cst.course_id;
      if (!groupedByCourse[courseId]) groupedByCourse[courseId] = [];
      groupedByCourse[courseId].push(cst);
    }

    // 6. Split available slots into 3 portions for CT1, CT2, CT3
    const slotCount = filteredSlots.length;
    const portion1End = Math.ceil(slotCount / 3);
    const portion2End = Math.ceil(2 * slotCount / 3);

    const portion1Slots = filteredSlots.slice(0, portion1End); // CT1
    const portion2Slots = filteredSlots.slice(portion1End, portion2End); // CT2
    const portion3Slots = filteredSlots.slice(portion2End); // CT3

    // 7. Collect CT1, CT2, CT3 assignments by CT number
    const assignmentsByCtNum: Record<number, Array<{ courseId: string; courseCSTs: CourseSectionTeacher[] }>> = {
      1: [],
      2: [],
      3: [],
    };

    for (const courseId of Object.keys(groupedByCourse)) {
      const courseCSTs = groupedByCourse[courseId];
      const firstCst = courseCSTs[0];
      const maxCtCount = firstCst.course.credit >= 3 ? 3 : 2;

      for (let ctNum = 1; ctNum <= maxCtCount; ctNum++) {
        if (!assignmentsByCtNum[ctNum]) assignmentsByCtNum[ctNum] = [];
        assignmentsByCtNum[ctNum].push({
          courseId,
          courseCSTs,
        });
      }
    }

    // 8. Assign CTs to their respective portions
    const assignments: Partial<CTAssignment>[] = [];
    const portionsByCtNum: Record<number, CTWeekConfig[]> = {
      1: portion1Slots,
      2: portion2Slots,
      3: portion3Slots,
    };

    for (const ctNum of [1, 2, 3]) {
      const coursesForThisCt = assignmentsByCtNum[ctNum] || [];
      const slotsForThisCt = portionsByCtNum[ctNum] || [];

      if (coursesForThisCt.length === 0 || slotsForThisCt.length === 0) continue;

      // Distribute courses evenly across slots for this CT
      const slotStepForCt = Math.max(1, Math.floor(slotsForThisCt.length / Math.max(1, coursesForThisCt.length)));

      for (let i = 0; i < coursesForThisCt.length; i++) {
        const { courseId, courseCSTs } = coursesForThisCt[i];
        const firstCst = courseCSTs[0];

        // Select slot within the designated portion for this CT
        const slotIndex = (i * slotStepForCt) % slotsForThisCt.length;
        const slot = slotsForThisCt[slotIndex];

        const dateStr = slot.date instanceof Date
          ? slot.date.toISOString().split('T')[0]
          : (slot.date as string);

        // Get rooms for this course's department (filter by department_id)
        let departmentRooms = allRooms.filter(r => {
          const isTheoryRoom = r.room_type === 'Theory' || r.room_type === 'Both';
          if (!isTheoryRoom) return false;

          if (firstCst.course.department_id) {
            return r.department_id === firstCst.course.department_id;
          } else {
            // Non-departmental courses can use any theory room
            return true;
          }
        });

        // Fallback to all theory rooms if department-specific rooms not available
        if (departmentRooms.length === 0) {
          departmentRooms = allRooms.filter(r =>
            (r.room_type === 'Theory' || r.room_type === 'Both')
          );
        }

        // Find booked rooms on this date
        const bookedRoomsOnDate = assignments
          .filter(a => {
            const aDate = a.date instanceof Date
              ? a.date.toISOString().split('T')[0]
              : (a.date as string);
            return aDate === dateStr;
          })
          .map(a => a.room_id);

        const availableRoomsOnDate = departmentRooms.filter(r => !bookedRoomsOnDate.includes(r.id));
        const roomsToUse = availableRoomsOnDate.length > 0 ? availableRoomsOnDate : departmentRooms;

        // Assign all sections of this course to the same date with different rooms
        for (let j = 0; j < courseCSTs.length; j++) {
          const cst = courseCSTs[j];
          const selectedRoom = roomsToUse[j % roomsToUse.length];

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
      }
    }

    // 9. Save assignments
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

