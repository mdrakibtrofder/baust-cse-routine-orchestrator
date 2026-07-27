import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CTSetting } from '../../entities/ct-setting.entity';
import { CTWeekConfig } from '../../entities/ct-week-config.entity';
import { CTAssignment } from '../../entities/ct-assignment.entity';
import { CTLevelTermDayMapping } from '../../entities/ct-level-term-day-mapping.entity';
import { CTLevelTermRoomMapping } from '../../entities/ct-level-term-room-mapping.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { Room } from '../../entities/room.entity';
import { Course } from '../../entities/course.entity';
import {
  UpdateCTSettingDto,
  UpdateCTWeekConfigsDto,
  UpdateCTAssignmentDto,
  UpdateCTLevelTermDayMappingsDto,
  UpdateCTLevelTermRoomMappingsDto,
} from '../../dtos/ct-schedule.dto';

@Injectable()
export class CTScheduleService {
  constructor(
    @InjectRepository(CTSetting)
    private readonly ctSettingRepository: Repository<CTSetting>,
    @InjectRepository(CTWeekConfig)
    private readonly ctWeekConfigRepository: Repository<CTWeekConfig>,
    @InjectRepository(CTAssignment)
    private readonly ctAssignmentRepository: Repository<CTAssignment>,
    @InjectRepository(CTLevelTermDayMapping)
    private readonly dayMappingRepository: Repository<CTLevelTermDayMapping>,
    @InjectRepository(CTLevelTermRoomMapping)
    private readonly roomMappingRepository: Repository<CTLevelTermRoomMapping>,
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
    if (dto.start_date) {
      // Ensure date is stored without time/timezone issues by using string part
      settings.start_date = new Date(dto.start_date.split('T')[0]);
    }
    return this.ctSettingRepository.save(settings);
  }

  private bucketWhere(semesterId: string, b: { level: number; term: string; departmental_type: string; department_id?: string | null }) {
    return {
      semester_id: semesterId,
      level: b.level,
      term: b.term,
      departmental_type: b.departmental_type,
      department_id: b.department_id ?? null,
    } as any;
  }

  async getDayMappings(semesterId: string) {
    if (!semesterId || semesterId === 'undefined') return [];
    return this.dayMappingRepository.find({ where: { semester_id: semesterId } });
  }

  async updateDayMappings(semesterId: string, dto: UpdateCTLevelTermDayMappingsDto) {
    if (!semesterId || semesterId === 'undefined') {
      throw new ConflictException('Invalid semester ID');
    }
    for (const m of dto.mappings) {
      const where = this.bucketWhere(semesterId, m);
      let existing = await this.dayMappingRepository.findOne({ where });
      if (existing) {
        existing.days = m.days;
        await this.dayMappingRepository.save(existing);
      } else {
        await this.dayMappingRepository.save(
          this.dayMappingRepository.create({ ...where, days: m.days }),
        );
      }
    }
    return this.getDayMappings(semesterId);
  }

  async getRoomMappings(semesterId: string) {
    if (!semesterId || semesterId === 'undefined') return [];
    return this.roomMappingRepository.find({ where: { semester_id: semesterId } });
  }

  async updateRoomMappings(semesterId: string, dto: UpdateCTLevelTermRoomMappingsDto) {
    if (!semesterId || semesterId === 'undefined') {
      throw new ConflictException('Invalid semester ID');
    }
    for (const m of dto.mappings) {
      const where = this.bucketWhere(semesterId, m);
      let existing = await this.roomMappingRepository.findOne({ where });
      if (existing) {
        existing.room_ids = m.room_ids;
        await this.roomMappingRepository.save(existing);
      } else {
        await this.roomMappingRepository.save(
          this.roomMappingRepository.create({ ...where, room_ids: m.room_ids }),
        );
      }
    }
    return this.getRoomMappings(semesterId);
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
      relations: ['course', 'room'],
      order: { date: 'ASC' },
    });
  }

  private static readonly WEEKDAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  private bucketKey(b: { level: number; term: string; departmental_type: string; department_id?: string | null }) {
    return `${b.level}|${b.term}|${b.departmental_type}|${b.department_id || ''}`;
  }

  private dateKey(d: Date | string) {
    return d instanceof Date ? d.toISOString().split('T')[0] : (d as string).split('T')[0];
  }

  /**
   * Level-term-bucket based CT generation. Every course is grouped into its
   * level+term+departmental_type(+department) bucket. Each bucket has a
   * day-mapping (which weekdays it tests on) and a room-mapping (which rooms
   * it may use, shared across every course in that bucket). CT1/CT2/CT3 for
   * a course are assigned serially in chronological order — any mapped
   * weekday may be used for any CT number — and spill onto the bucket's next
   * available mapped day when the mapped rooms are full on a given date.
   * There is no section dimension any more: one CTAssignment row per
   * (course, ct_number).
   */
  async generateSchedule(semesterId: string) {
    if (!semesterId || semesterId === 'undefined') {
      throw new ConflictException('Invalid semester ID');
    }

    // 1. Clear existing assignments
    await this.ctAssignmentRepository.delete({ semester_id: semesterId });

    // 2. Determine theory courses actually offered this semester
    const csts = await this.cstRepository.find({
      where: { semester_id: semesterId },
      relations: ['course'],
    });
    const courseById = new Map<string, Course>();
    for (const cst of csts) {
      if (cst.course.course_type.startsWith('theory')) {
        courseById.set(cst.course_id, cst.course);
      }
    }
    const theoryCourses = Array.from(courseById.values());
    if (theoryCourses.length === 0) {
      throw new ConflictException('No theory courses offered this semester — nothing to schedule.');
    }

    // 3. Group courses into level-term buckets
    const coursesByBucket = new Map<string, Course[]>();
    for (const course of theoryCourses) {
      const key = this.bucketKey(course);
      if (!coursesByBucket.has(key)) coursesByBucket.set(key, []);
      coursesByBucket.get(key)!.push(course);
    }

    // 4. Load day mappings and room mappings, indexed by bucket
    const [dayMappings, roomMappings, allRooms] = await Promise.all([
      this.getDayMappings(semesterId),
      this.getRoomMappings(semesterId),
      this.roomRepository.find(),
    ]);
    const dayMappingByBucket = new Map<string, CTLevelTermDayMapping>();
    for (const m of dayMappings) dayMappingByBucket.set(this.bucketKey(m), m);
    const roomMappingByBucket = new Map<string, CTLevelTermRoomMapping>();
    for (const m of roomMappings) roomMappingByBucket.set(this.bucketKey(m), m);
    const roomsById = new Map(allRooms.map(r => [r.id, r]));

    // 5. Load the semester-wide availability calendar (blackout dates already excluded)
    const availableConfigs = await this.ctWeekConfigRepository.find({
      where: { semester_id: semesterId, is_available: true },
      order: { week_number: 'ASC', date: 'ASC' },
    });
    if (availableConfigs.length === 0) {
      throw new ConflictException(
        'No available CT dates configured. Please configure the CT calendar and Level-Term Day/Room mappings first.',
      );
    }

    // 6. Generate assignments bucket by bucket
    const assignments: Partial<CTAssignment>[] = [];
    const roomBookedByDate = new Map<string, Set<string>>(); // dateStr -> booked room ids (global, across all buckets)
    const skippedBuckets: string[] = [];
    const shortfalls: string[] = [];

    for (const [key, coursesInBucket] of coursesByBucket.entries()) {
      const dayMapping = dayMappingByBucket.get(key);
      const roomMapping = roomMappingByBucket.get(key);
      const mappedDays = dayMapping?.days ?? [];
      const mappedRoomIds = (roomMapping?.room_ids ?? []).filter(id => roomsById.has(id));

      if (mappedDays.length === 0 || mappedRoomIds.length === 0) {
        const sample = coursesInBucket[0];
        skippedBuckets.push(`Level ${sample.level}-${sample.term} (${sample.departmental_type})`);
        continue;
      }

      const candidateDates = availableConfigs
        .filter(cfg => mappedDays.includes(CTScheduleService.WEEKDAY_CODES[new Date(cfg.date).getUTCDay()]))
        .map(cfg => ({ dateStr: this.dateKey(cfg.date), date: cfg.date, week_number: cfg.week_number }));

      if (candidateDates.length === 0) {
        const sample = coursesInBucket[0];
        skippedBuckets.push(`Level ${sample.level}-${sample.term} (${sample.departmental_type}) — no available date falls on mapped days`);
        continue;
      }

      coursesInBucket.sort((a, b) => a.code.localeCompare(b.code));

      let dateCursor = 0;
      for (const ctNum of [1, 2, 3]) {
        for (const course of coursesInBucket) {
          const maxCtCount = Number(course.credit) >= 3 ? 3 : 2;
          if (ctNum > maxCtCount) continue;

          let placed = false;
          for (let i = dateCursor; i < candidateDates.length; i++) {
            const candidate = candidateDates[i];
            const bookedOnDate = roomBookedByDate.get(candidate.dateStr) ?? new Set<string>();
            const freeRoomId = mappedRoomIds.find(rid => !bookedOnDate.has(rid));
            if (!freeRoomId) continue;

            bookedOnDate.add(freeRoomId);
            roomBookedByDate.set(candidate.dateStr, bookedOnDate);

            assignments.push({
              semester_id: semesterId,
              course_id: course.id,
              room_id: freeRoomId,
              week_number: candidate.week_number,
              date: candidate.date,
              ct_number: ctNum,
            });

            dateCursor = i;
            placed = true;
            break;
          }

          if (!placed) {
            shortfalls.push(`${course.code} CT${ctNum} (Level ${course.level}-${course.term})`);
          }
        }
      }
    }

    if (assignments.length === 0) {
      const detail = skippedBuckets.length > 0
        ? ` Missing day/room mapping for: ${skippedBuckets.join('; ')}.`
        : '';
      throw new ConflictException(`Cannot generate CT schedule — no level-term has a complete day and room mapping.${detail}`);
    }

    // 7. Save assignments
    await this.ctAssignmentRepository.save(this.ctAssignmentRepository.create(assignments));

    if (skippedBuckets.length > 0) {
      console.warn('CT generation skipped buckets without mapping:', skippedBuckets.join('; '));
    }
    if (shortfalls.length > 0) {
      console.warn('CT generation ran out of dates/rooms for:', shortfalls.join('; '));
    }

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

