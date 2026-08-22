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
  SwapCTDto,
} from '../../dtos/ct-schedule.dto';

/** Minimum number of weeks between consecutive class tests of the same course.
 *  Keep in sync with `CT_MIN_WEEK_GAP` in shared/constants.ts and the frontend copy
 *  in src/lib/constants.ts. A gap of 3 means CT1 in week 4 puts CT2 in week 7 at the
 *  earliest and CT3 in week 10 at the earliest. */
const CT_MIN_WEEK_GAP = 3;

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
      settings.start_date = CTScheduleService.dateOnly(dto.start_date) as unknown as Date;
    }
    return this.ctSettingRepository.save(settings);
  }

  /** Normalise any incoming date to a bare `YYYY-MM-DD` string.
   *  Postgres `date` columns must never be written as a JS Date: TypeORM converts
   *  a Date using the *server's local* calendar fields, so a UTC-midnight Date is
   *  stored one day earlier on any server west of UTC. Keeping dates as strings
   *  end-to-end makes the stored day identical to the day the user picked. */
  private static dateOnly(v: string | Date): string {
    if (v instanceof Date) {
      return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
    }
    return String(v).split('T')[0];
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

  /** Replaces the semester's CT calendar wholesale with the grid the client sends.
   *
   *  This must be a full replace, not an upsert. Upserting leaves rows behind
   *  whenever the start date or total weeks changes: the old calendar stays in the
   *  table, invisible in the UI (which only renders dates derived from the current
   *  start date) but still `is_available`, and generation — which reads every
   *  available row for the semester — then scatters class tests across the old and
   *  new date ranges at once (e.g. February–September instead of August–November). */
  async updateWeekConfigs(semesterId: string, dto: UpdateCTWeekConfigsDto) {
    if (!semesterId || semesterId === 'undefined') {
      throw new ConflictException('Invalid semester ID');
    }

    // Deduplicate by (week_number, date) so a malformed payload can't violate the
    // unique index; the last entry for a key wins.
    const byKey = new Map<string, { week_number: number; date: string; is_available: boolean }>();
    for (const config of dto.configs) {
      const date = CTScheduleService.dateOnly(config.date);
      byKey.set(`${config.week_number}|${date}`, {
        week_number: config.week_number,
        date,
        is_available: config.is_available,
      });
    }

    await this.ctWeekConfigRepository.manager.transaction(async (manager) => {
      await manager.delete(CTWeekConfig, { semester_id: semesterId });
      const rows = Array.from(byKey.values()).map((c) =>
        manager.create(CTWeekConfig, {
          semester_id: semesterId,
          week_number: c.week_number,
          date: c.date as unknown as Date,
          is_available: c.is_available,
        }),
      );
      if (rows.length > 0) await manager.save(rows);
    });

    return this.getWeekConfigs(semesterId);
  }

  async getAssignments(semesterId: string) {
    if (!semesterId || semesterId === 'undefined') return [];
    return this.ctAssignmentRepository.find({
      where: { semester_id: semesterId },
      relations: ['course'],
      order: { date: 'ASC' },
    });
  }

  private static readonly WEEKDAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  private bucketKey(b: { level: number; term: string; departmental_type: string; department_id?: string | null }) {
    return `${b.level}|${b.term}|${b.departmental_type}|${b.department_id || ''}`;
  }

  private dateKey(d: Date | string) {
    return CTScheduleService.dateOnly(d);
  }

  /** Weekday code (SUN…SAT) of a `YYYY-MM-DD` string, computed in UTC so it can
   *  never drift by a day depending on where the server runs. */
  private weekdayCode(dateStr: string) {
    return CTScheduleService.WEEKDAY_CODES[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
  }

  /**
   * Level-term-bucket based CT generation. Every course is grouped into its
   * level+term+departmental_type(+department) bucket. Each bucket has a
   * day-mapping (which weekdays it tests on) and a room-mapping (which rooms
   * it may use, shared across every course in that bucket). There is no section
   * dimension: one CTAssignment row per (course, ct_number).
   *
   * Placement rules:
   *  - **Whole room mapping per sitting.** A class test occupies *every* room mapped
   *    to its level-term, because the entire cohort sits it at once spread across
   *    those rooms. A date is therefore only usable if the bucket's full room set is
   *    free, which also means two courses of the same level-term can never share a
   *    date.
   *  - **Round by round.** Every course gets its CT1 before any course gets a CT2,
   *    and every CT2 before any CT3. Rounds are placed in ascending CT number, so
   *    a course can never end up with CT2 earlier than its CT1.
   *  - **Minimum spacing.** Consecutive class tests of the same course sit at least
   *    `CT_MIN_WEEK_GAP` weeks apart, measured in configured week numbers — CT1 in
   *    week 4 pushes CT2 to week 7 or later, and CT3 to week 10 or later.
   *  - **Earliest fit.** Within those constraints each CT takes the earliest mapped
   *    date whose rooms are all free, so the calendar packs from the front.
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

    // 5. Load the semester-wide availability calendar (blackout dates already excluded).
    //    Rows are additionally clamped to the configured window — week numbers within
    //    total_weeks and dates on/after the start date — so a calendar left over from
    //    an earlier start date can never leak into the generated schedule.
    const settings = await this.getSettings(semesterId);
    const startDateStr = settings.start_date ? CTScheduleService.dateOnly(settings.start_date) : null;
    const allConfigs = await this.ctWeekConfigRepository.find({
      where: { semester_id: semesterId, is_available: true },
      order: { week_number: 'ASC', date: 'ASC' },
    });
    const availableConfigs = allConfigs.filter((cfg) => {
      if (cfg.week_number < 1 || cfg.week_number > settings.total_weeks) return false;
      if (startDateStr && this.dateKey(cfg.date) < startDateStr) return false;
      return true;
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

      // Only the exact dates the user marked available in the CT calendar, further
      // restricted to this bucket's mapped weekdays. Nothing is derived from the
      // start date here — the configuration rows are the single source of truth.
      const candidateDates = availableConfigs
        .map(cfg => ({ dateStr: this.dateKey(cfg.date), week_number: cfg.week_number }))
        .filter(c => mappedDays.includes(this.weekdayCode(c.dateStr)));

      if (candidateDates.length === 0) {
        const sample = coursesInBucket[0];
        skippedBuckets.push(`Level ${sample.level}-${sample.term} (${sample.departmental_type}) — no available date falls on mapped days`);
        continue;
      }

      coursesInBucket.sort((a, b) => a.code.localeCompare(b.code));

      // Week number of the most recent CT placed for each course, so the next round
      // can honour the minimum gap. Undefined until that course has its CT1.
      const lastWeekByCourse = new Map<string, number>();

      // Rounds run in CT order: every CT1 is placed before any CT2, every CT2 before
      // any CT3. Combined with the gap rule below, a course's CTs are always in
      // ascending date order.
      for (const ctNum of [1, 2, 3]) {
        for (const course of coursesInBucket) {
          const maxCtCount = Number(course.credit) >= 3 ? 3 : 2;
          if (ctNum > maxCtCount) continue;

          // A later CT may only start once the gap since the previous one has elapsed.
          // A course whose previous CT could not be placed is skipped rather than
          // scheduled out of order.
          const previousWeek = lastWeekByCourse.get(course.id);
          if (ctNum > 1 && previousWeek === undefined) {
            shortfalls.push(
              `${course.code} CT${ctNum} (Level ${course.level}-${course.term}) — skipped because CT${ctNum - 1} could not be placed`,
            );
            continue;
          }
          const earliestWeek = previousWeek === undefined ? 0 : previousWeek + CT_MIN_WEEK_GAP;

          let placed = false;
          for (const candidate of candidateDates) {
            if (candidate.week_number < earliestWeek) continue;

            // The sitting needs the bucket's *entire* room mapping, so the date is
            // only usable when none of those rooms is already taken — by another
            // level-term sharing a room, or by another course of this one.
            const bookedOnDate = roomBookedByDate.get(candidate.dateStr) ?? new Set<string>();
            if (mappedRoomIds.some(rid => bookedOnDate.has(rid))) continue;

            for (const rid of mappedRoomIds) bookedOnDate.add(rid);
            roomBookedByDate.set(candidate.dateStr, bookedOnDate);

            assignments.push({
              semester_id: semesterId,
              course_id: course.id,
              room_ids: [...mappedRoomIds],
              week_number: candidate.week_number,
              date: candidate.dateStr as unknown as Date,
              ct_number: ctNum,
            });

            lastWeekByCourse.set(course.id, candidate.week_number);
            placed = true;
            break;
          }

          if (!placed) {
            shortfalls.push(
              `${course.code} CT${ctNum} (Level ${course.level}-${course.term})` +
                (previousWeek !== undefined
                  ? ` — no mapped day in week ${earliestWeek} or later has all mapped rooms free`
                  : ''),
            );
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

    const targetRoomIds = dto.room_ids ?? assignment.room_ids ?? [];
    const targetDate = CTScheduleService.dateOnly(dto.date ?? assignment.date);

    if ((dto.room_ids || dto.date) && targetRoomIds.length > 0) {
      // A sitting takes all of its rooms, so it clashes with any other sitting on
      // that date that shares even one room.
      const sameDay = await this.ctAssignmentRepository.find({
        where: { semester_id: assignment.semester_id, date: targetDate as unknown as Date },
        relations: ['course'],
      });
      const clash = sameDay.find(
        (other) => other.id !== id && other.room_ids?.some((rid) => targetRoomIds.includes(rid)),
      );
      if (clash) {
        throw new ConflictException(
          `Room conflict: ${clash.course?.code ?? 'another CT'} CT${clash.ct_number} already uses one of these rooms on this date`,
        );
      }
    }

    if (dto.room_ids) assignment.room_ids = dto.room_ids;
    if (dto.date) {
      const dateStr = CTScheduleService.dateOnly(dto.date);
      assignment.date = dateStr as unknown as Date;
      // Keep the week number in step with the CT calendar rather than trusting a
      // stale value from the client — the week a date belongs to is configuration.
      const cfg = await this.ctWeekConfigRepository.findOne({
        where: { semester_id: assignment.semester_id, date: dateStr as unknown as Date },
      });
      if (cfg) assignment.week_number = cfg.week_number;
    }
    if (dto.week_number && !dto.date) assignment.week_number = dto.week_number;

    return this.ctAssignmentRepository.save(assignment);
  }

  // -------------------------------------------------------------------------
  // Swapping class tests between courses
  // -------------------------------------------------------------------------

  /** The scheduling half of a sitting — everything a swap exchanges. A sitting's
   *  identity (course, CT number) never moves; only when and where it happens. */
  private static slotOf(a: CTAssignment) {
    return {
      date: CTScheduleService.dateOnly(a.date),
      week_number: a.week_number,
      room_ids: [...(a.room_ids ?? [])],
    };
  }

  private static courseLabel(c?: Course | null) {
    return c?.code ?? 'course';
  }

  /** Resolves a swap request into the concrete pairs of sittings that will trade
   *  places, rejecting anything the two modes forbid.
   *
   *  Shared rules (both modes):
   *   - both sides belong to the semester being edited;
   *   - the two courses are different courses;
   *   - the two courses sit in the same level-term bucket, since the bucket owns
   *     the weekday and room mapping a sitting is placed against.
   *
   *  `all` additionally requires equal credit and an identical set of CT numbers,
   *  so every sitting on one side has exactly one partner on the other.
   *  `single` additionally requires the two sittings to share a CT number. */
  private async resolveSwapPairs(
    semesterId: string,
    dto: SwapCTDto,
  ): Promise<{ a: CTAssignment; b: CTAssignment }[]> {
    if (!semesterId || semesterId === 'undefined') {
      throw new ConflictException('Invalid semester ID');
    }

    const sameBucket = (x: Course, y: Course) =>
      x.level === y.level &&
      x.term === y.term &&
      x.departmental_type === y.departmental_type &&
      (x.department_id ?? null) === (y.department_id ?? null);

    if (dto.mode === 'single') {
      if (!dto.assignment_a_id || !dto.assignment_b_id) {
        throw new ConflictException('Both CT sittings must be supplied for a single swap.');
      }
      if (dto.assignment_a_id === dto.assignment_b_id) {
        throw new ConflictException('A CT cannot be swapped with itself.');
      }
      const [a, b] = await Promise.all([
        this.ctAssignmentRepository.findOne({ where: { id: dto.assignment_a_id }, relations: ['course'] }),
        this.ctAssignmentRepository.findOne({ where: { id: dto.assignment_b_id }, relations: ['course'] }),
      ]);
      if (!a || !b) throw new NotFoundException('CT assignment not found');
      if (a.semester_id !== semesterId || b.semester_id !== semesterId) {
        throw new ConflictException('Both CTs must belong to the active semester.');
      }
      if (a.course_id === b.course_id) {
        throw new ConflictException('Pick a CT of a different course to swap with.');
      }
      if (a.ct_number !== b.ct_number) {
        throw new ConflictException(
          `A CT can only swap with the same CT number — CT${a.ct_number} cannot swap with CT${b.ct_number}.`,
        );
      }
      if (a.course && b.course && !sameBucket(a.course, b.course)) {
        throw new ConflictException(
          `${CTScheduleService.courseLabel(a.course)} and ${CTScheduleService.courseLabel(b.course)} are not in the same level-term, so their CT days and rooms are not interchangeable.`,
        );
      }
      return [{ a, b }];
    }

    // ---- mode: all ----------------------------------------------------------
    if (!dto.course_a_id || !dto.course_b_id) {
      throw new ConflictException('Both courses must be supplied for a swap-all.');
    }
    if (dto.course_a_id === dto.course_b_id) {
      throw new ConflictException('A course cannot be swapped with itself.');
    }

    const [courseA, courseB] = await Promise.all([
      this.courseRepository.findOne({ where: { id: dto.course_a_id } }),
      this.courseRepository.findOne({ where: { id: dto.course_b_id } }),
    ]);
    if (!courseA || !courseB) throw new NotFoundException('Course not found');

    if (!sameBucket(courseA, courseB)) {
      throw new ConflictException(
        `${courseA.code} (Level ${courseA.level}-${courseA.term}) and ${courseB.code} (Level ${courseB.level}-${courseB.term}) are not in the same level-term, so their CT days and rooms are not interchangeable.`,
      );
    }
    if (Number(courseA.credit) !== Number(courseB.credit)) {
      throw new ConflictException(
        `${courseA.code} is ${courseA.credit} credit and ${courseB.code} is ${courseB.credit} credit. Only courses of equal credit can have their whole CT series swapped.`,
      );
    }

    const [ctsA, ctsB] = await Promise.all([
      this.ctAssignmentRepository.find({
        where: { semester_id: semesterId, course_id: courseA.id },
        relations: ['course'],
      }),
      this.ctAssignmentRepository.find({
        where: { semester_id: semesterId, course_id: courseB.id },
        relations: ['course'],
      }),
    ]);
    if (ctsA.length === 0 || ctsB.length === 0) {
      throw new ConflictException('Both courses need a generated CT schedule before they can be swapped.');
    }

    const byNumberB = new Map(ctsB.map((x) => [x.ct_number, x]));
    const numbersA = ctsA.map((x) => x.ct_number).sort((m, n) => m - n);
    const numbersB = ctsB.map((x) => x.ct_number).sort((m, n) => m - n);
    if (numbersA.join(',') !== numbersB.join(',')) {
      throw new ConflictException(
        `${courseA.code} has CT ${numbersA.join(', ')} but ${courseB.code} has CT ${numbersB.join(', ')} — every CT needs a partner to swap with.`,
      );
    }

    return ctsA
      .sort((m, n) => m.ct_number - n.ct_number)
      .map((a) => ({ a, b: byNumberB.get(a.ct_number)! }));
  }

  /** Everything that would be wrong with the schedule *after* a swap, expressed as
   *  human-readable warnings. These are advisory rather than fatal: a scheduler may
   *  knowingly accept a tight gap, so the endpoint reports them and lets the client
   *  re-submit with `force`.
   *
   *  Three things are checked against the post-swap state:
   *   - a course's sittings must stay in CT order (CT1 before CT2 before CT3);
   *   - consecutive sittings of one course must stay `CT_MIN_WEEK_GAP` weeks apart;
   *   - no two sittings anywhere in the semester may share a room on a date.
   *     A whole-series swap between two courses of one bucket can never break this
   *     (the occupied set is merely relabelled), but the check is cheap insurance
   *     against a room set that was hand-edited away from its bucket mapping. */
  private async collectSwapWarnings(
    semesterId: string,
    pairs: { a: CTAssignment; b: CTAssignment }[],
  ): Promise<string[]> {
    const all = await this.ctAssignmentRepository.find({
      where: { semester_id: semesterId },
      relations: ['course'],
    });

    // Project the swap onto a copy of the semester's schedule.
    const swapped = new Map<string, { date: string; week_number: number; room_ids: string[] }>();
    for (const { a, b } of pairs) {
      swapped.set(a.id, CTScheduleService.slotOf(b));
      swapped.set(b.id, CTScheduleService.slotOf(a));
    }
    const projected = all.map((row) => {
      const next = swapped.get(row.id);
      return {
        id: row.id,
        course_id: row.course_id,
        course: row.course,
        ct_number: row.ct_number,
        ...(next ?? CTScheduleService.slotOf(row)),
      };
    });
    type ProjectedCT = (typeof projected)[number];

    const warnings: string[] = [];

    // Per-course ordering and spacing.
    const touchedCourseIds = new Set(pairs.flatMap(({ a, b }) => [a.course_id, b.course_id]));
    const byCourse = new Map<string, ProjectedCT[]>();
    for (const row of projected) {
      if (!touchedCourseIds.has(row.course_id)) continue;
      if (!byCourse.has(row.course_id)) byCourse.set(row.course_id, []);
      byCourse.get(row.course_id)!.push(row);
    }
    for (const rows of byCourse.values()) {
      rows.sort((m, n) => m.ct_number - n.ct_number);
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1];
        const cur = rows[i];
        const code = CTScheduleService.courseLabel(cur.course);
        if (cur.week_number <= prev.week_number) {
          warnings.push(
            `${code}: CT${cur.ct_number} would fall in week ${cur.week_number}, on or before CT${prev.ct_number} in week ${prev.week_number} — the series would be out of order.`,
          );
        } else if (cur.week_number - prev.week_number < CT_MIN_WEEK_GAP) {
          warnings.push(
            `${code}: only ${cur.week_number - prev.week_number} week(s) between CT${prev.ct_number} and CT${cur.ct_number} — the minimum gap is ${CT_MIN_WEEK_GAP}.`,
          );
        }
      }
    }

    // Room clashes across the whole semester.
    const byDate = new Map<string, ProjectedCT[]>();
    for (const row of projected) {
      if (!byDate.has(row.date)) byDate.set(row.date, []);
      byDate.get(row.date)!.push(row);
    }
    for (const [date, rows] of byDate.entries()) {
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const shared = rows[i].room_ids.filter((rid) => rows[j].room_ids.includes(rid));
          if (shared.length === 0) continue;
          warnings.push(
            `Room clash on ${date}: ${CTScheduleService.courseLabel(rows[i].course)} CT${rows[i].ct_number} and ${CTScheduleService.courseLabel(rows[j].course)} CT${rows[j].ct_number} would share a room.`,
          );
        }
      }
    }

    return warnings;
  }

  /** Dry run: resolves the swap and reports what it would do, without writing.
   *  The client uses this to show a confirmation (and any warnings) before asking
   *  for the swap itself with `force`. */
  async previewSwap(semesterId: string, dto: SwapCTDto) {
    const pairs = await this.resolveSwapPairs(semesterId, dto);
    const warnings = await this.collectSwapWarnings(semesterId, pairs);
    return {
      pairs: pairs.map(({ a, b }) => ({
        ct_number: a.ct_number,
        a: {
          id: a.id,
          course_id: a.course_id,
          course_code: a.course?.code ?? null,
          ...CTScheduleService.slotOf(a),
        },
        b: {
          id: b.id,
          course_id: b.course_id,
          course_code: b.course?.code ?? null,
          ...CTScheduleService.slotOf(b),
        },
      })),
      warnings,
    };
  }

  /** Performs the swap in one transaction, so a failure part-way cannot leave two
   *  courses sharing a date. Only date, week number and room set move; the unique
   *  (semester, course, ct_number) index is untouched, so no temporary placeholder
   *  row is needed. */
  async swapCTs(semesterId: string, dto: SwapCTDto) {
    const pairs = await this.resolveSwapPairs(semesterId, dto);
    const warnings = await this.collectSwapWarnings(semesterId, pairs);

    if (warnings.length > 0 && !dto.force) {
      throw new ConflictException({
        message: 'Swap would leave the CT schedule inconsistent.',
        conflicts: warnings.map((message) => ({ message })),
      });
    }

    await this.ctAssignmentRepository.manager.transaction(async (manager) => {
      for (const { a, b } of pairs) {
        const slotA = CTScheduleService.slotOf(a);
        const slotB = CTScheduleService.slotOf(b);
        await manager.update(CTAssignment, a.id, {
          date: slotB.date as unknown as Date,
          week_number: slotB.week_number,
          room_ids: slotB.room_ids,
        });
        await manager.update(CTAssignment, b.id, {
          date: slotA.date as unknown as Date,
          week_number: slotA.week_number,
          room_ids: slotA.room_ids,
        });
      }
    });

    return {
      swapped: pairs.length,
      warnings,
      assignments: await this.getAssignments(semesterId),
    };
  }

}

