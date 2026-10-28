import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CTSetting } from '../../entities/ct-setting.entity';
import { CTWeekConfig } from '../../entities/ct-week-config.entity';
import { CTAssignment } from '../../entities/ct-assignment.entity';
import { CTLevelTermRoomMapping } from '../../entities/ct-level-term-room-mapping.entity';
import { CTRescheduleSnapshot, CTSnapshotAssignment } from '../../entities/ct-reschedule-snapshot.entity';
import { Course } from '../../entities/course.entity';
import { Department } from '../../entities/department.entity';
import { CTScheduleService } from './ct-schedule.service';

/** Class tests from this week on are the ones the reschedule moves. Week 10 is
 *  included even though it never actually runs: those tests were never held, so
 *  they are re-placed along with the weeks 11–14 ones rather than left behind. */
const RESCHEDULE_FROM_WEEK = 10;

/** The reschedule window. There is no week 10 on this semester's calendar, so the
 *  re-placed tests land in weeks 11–14. */
const RESCHEDULE_FIRST_WEEK = 11;
const RESCHEDULE_LAST_WEEK = 14;

type RescheduleGroup = 1 | 2;

/** The department's level-terms split into the two sitting groups.
 *
 *  Group 1 tests Monday + Wednesday in the odd window weeks (11, 13) and
 *  Sunday + Tuesday + Thursday in the even ones (12, 14); Group 2 is the
 *  mirror image, so the two groups never share a day. */
const GROUP_1_LEVEL_TERMS = ['1|I', '1|II', '3|II', '4|II'];
const GROUP_2_LEVEL_TERMS = ['2|I', '2|II', '3|I', '4|I'];

function groupForLevelTerm(level: number, term: string): RescheduleGroup | null {
  const key = `${level}|${term}`;
  if (GROUP_1_LEVEL_TERMS.includes(key)) return 1;
  if (GROUP_2_LEVEL_TERMS.includes(key)) return 2;
  return null;
}

/** Which weekdays a group sits on during a given window week. */
function daysForGroup(group: RescheduleGroup, week: number): string[] {
  const oddWeek = week % 2 === 1; // weeks 11 and 13
  if (group === 1) return oddWeek ? ['MON', 'WED'] : ['SUN', 'TUE', 'THU'];
  return oddWeek ? ['SUN', 'TUE', 'THU'] : ['MON', 'WED'];
}

/** `count` of `slots`, chosen as evenly across the list as their number allows.
 *  Used to drop a level-term's overflow class tests into the weeks its own days
 *  run out on, rather than piling them all onto the first free dates. */
function pickSpread<T>(slots: T[], count: number): T[] {
  if (count <= 0) return [];
  if (count >= slots.length) return [...slots];
  const picked: T[] = [];
  for (let i = 1; i <= count && picked.length < count; i++) {
    const index = Math.min(Math.max(Math.round((i * slots.length) / (count + 1)) - 1, 0), slots.length - 1);
    if (!picked.includes(slots[index])) picked.push(slots[index]);
  }
  // Rounding can land twice on the same slot; top the rest up in order.
  for (const slot of slots) {
    if (picked.length >= count) break;
    if (!picked.includes(slot)) picked.push(slot);
  }
  return picked;
}

/** One sitting's before/after, as the page renders it. */
export interface RescheduleShift {
  id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  level: number;
  term: string;
  group: RescheduleGroup;
  ct_number: number;
  room_ids: string[];
  old_date: string;
  old_week: number;
  new_date: string;
  new_week: number;
  status: 'moved' | 'unchanged' | 'unplaced';
  /** Why a sitting could not be placed, when `status` is `unplaced`. */
  note?: string;
}

/** Two or more *different* courses of one level-term sharing a date. They cannot
 *  both sit then: a level-term takes its class tests as a single cohort, so its
 *  date has to be unique whatever rooms the sittings occupy. */
export interface RescheduleConflict {
  level: number;
  term: string;
  date: string;
  week: number;
  courses: { course_code: string; ct_number: number }[];
}

/** Two level-terms sitting in the same room on the same date. A sitting occupies
 *  its level-term's whole room set, so sharing a room is a real clash — the
 *  reschedule avoids it wherever the window allows, and reports what is left. */
export interface RescheduleOverlap {
  date: string;
  week: number;
  room_ids: string[];
  entries: { level: number; term: string; course_code: string; ct_number: number }[];
}

/** A sitting plus the scheduling fields the reschedule reads and writes. */
interface BaseSitting {
  id: string;
  course_id: string;
  course: Course;
  room_ids: string[];
  week_number: number;
  date: string;
  ct_number: number;
}

@Injectable()
export class CTRescheduleService {
  private static readonly WEEKDAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  constructor(
    @InjectRepository(CTSetting)
    private readonly ctSettingRepository: Repository<CTSetting>,
    @InjectRepository(CTWeekConfig)
    private readonly ctWeekConfigRepository: Repository<CTWeekConfig>,
    @InjectRepository(CTAssignment)
    private readonly ctAssignmentRepository: Repository<CTAssignment>,
    @InjectRepository(CTLevelTermRoomMapping)
    private readonly roomMappingRepository: Repository<CTLevelTermRoomMapping>,
    @InjectRepository(CTRescheduleSnapshot)
    private readonly snapshotRepository: Repository<CTRescheduleSnapshot>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  private static weekdayCode(d: string | Date): string {
    const dateStr = CTScheduleService.dateOnly(d);
    return CTRescheduleService.WEEKDAY_CODES[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
  }

  private assertSemester(semesterId: string) {
    if (!semesterId || semesterId === 'undefined') {
      throw new ConflictException('Invalid semester ID');
    }
  }

  /** The home department. `null` when it has not been created yet, in which case
   *  every Departmental course counts as a CSE course. */
  private async cseDepartment(): Promise<Department | null> {
    return this.departmentRepository.findOne({ where: { short_name: 'CSE' } });
  }

  /** A sitting the reschedule is allowed to move: a CSE level-term class test
   *  sitting in week 10 or later. Everything else — other departments, other
   *  level-terms, and any CT before week 10 — is left exactly where it is. */
  private isMovable(course: Course | undefined | null, week: number, cseId: string | null): boolean {
    if (!course) return false;
    if (course.departmental_type !== 'Departmental') return false;
    if (cseId && course.department_id && course.department_id !== cseId) return false;
    if (!groupForLevelTerm(course.level, course.term)) return false;
    return week >= RESCHEDULE_FROM_WEEK;
  }

  private async listAssignments(semesterId: string) {
    return this.ctAssignmentRepository.find({
      where: { semester_id: semesterId },
      relations: ['course'],
      order: { date: 'ASC' },
    });
  }

  /** Every date where two or more different courses of one reschedule level-term
   *  sit at the same time. Used both to report the clashes the current schedule
   *  already has and to confirm the generated one has none.
   *
   *  With `movableIds`, only the clashes this reschedule is responsible for are
   *  returned — a pair of sittings that both stay put cannot be separated here. */
  private findCollisions(
    rows: { id: string; course: Course; date: string; week_number: number; ct_number: number }[],
    movableIds?: Set<string>,
  ): RescheduleConflict[] {
    const byLevelTermDate = new Map<
      string,
      { id: string; course: Course; date: string; week_number: number; ct_number: number }[]
    >();
    for (const row of rows) {
      if (!groupForLevelTerm(row.course.level, row.course.term)) continue;
      const key = `${row.course.level}|${row.course.term}|${row.date}`;
      const list = byLevelTermDate.get(key) ?? [];
      list.push(row);
      byLevelTermDate.set(key, list);
    }

    const conflicts: RescheduleConflict[] = [];
    for (const [key, list] of byLevelTermDate) {
      // One course cannot clash with itself — only different courses count.
      if (new Set(list.map((r) => r.course.id)).size < 2) continue;
      if (movableIds && !list.some((r) => movableIds.has(r.id))) continue;
      const [level, term, date] = key.split('|');
      conflicts.push({
        level: Number(level),
        term,
        date,
        week: list[0].week_number,
        courses: list
          .map((r) => ({ course_code: r.course.code, ct_number: r.ct_number }))
          .sort((a, b) => a.course_code.localeCompare(b.course_code) || a.ct_number - b.ct_number),
      });
    }

    return conflicts.sort(
      (a, b) => a.level - b.level || a.term.localeCompare(b.term) || a.date.localeCompare(b.date),
    );
  }

  /** Every date where two level-terms of the reschedule sit in the same room.
   *  Reported on the generated schedule, not the current one: the current
   *  schedule's own room clashes are the generator's business, while these are
   *  the ones the window left no way around. */
  private findRoomOverlaps(
    rows: {
      course: Course;
      date: string;
      week_number: number;
      ct_number: number;
      room_ids: string[];
    }[],
  ): RescheduleOverlap[] {
    const byDate = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!groupForLevelTerm(row.course.level, row.course.term)) continue;
      if (row.room_ids.length === 0) continue;
      const list = byDate.get(row.date) ?? [];
      list.push(row);
      byDate.set(row.date, list);
    }

    const overlaps: RescheduleOverlap[] = [];
    for (const [date, list] of byDate) {
      const byLevelTerm = new Map<string, typeof rows>();
      for (const row of list) {
        const key = `${row.course.level}|${row.course.term}`;
        const bucket = byLevelTerm.get(key) ?? [];
        bucket.push(row);
        byLevelTerm.set(key, bucket);
      }

      const keys = [...byLevelTerm.keys()];
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const left = byLevelTerm.get(keys[i])!;
          const right = byLevelTerm.get(keys[j])!;
          const shared = new Set(
            left.flatMap((r) => r.room_ids).filter((rid) => right.some((r) => r.room_ids.includes(rid))),
          );
          if (shared.size === 0) continue;
          overlaps.push({
            date,
            week: list[0].week_number,
            room_ids: [...shared],
            entries: [...left, ...right]
              .map((r) => ({
                level: r.course.level,
                term: r.course.term,
                course_code: r.course.code,
                ct_number: r.ct_number,
              }))
              .sort(
                (a, b) =>
                  a.level - b.level || a.term.localeCompare(b.term) || a.course_code.localeCompare(b.course_code),
              ),
          });
        }
      }
    }

    return overlaps.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Drops a semester's snapshot. Called whenever the whole CT schedule is
   *  regenerated — the schedule the snapshot describes no longer exists. */
  async clearSnapshot(semesterId: string) {
    if (!semesterId || semesterId === 'undefined') return;
    await this.snapshotRepository.delete({ semester_id: semesterId });
  }

  /** The current movable sittings, straight from the database. Used once, to
   *  take the snapshot on the very first Apply. */
  private async loadCurrentMovable(
    semesterId: string,
  ): Promise<{ rows: CTAssignment[]; cseId: string | null }> {
    const assignments = await this.ctAssignmentRepository.find({
      where: { semester_id: semesterId },
      relations: ['course'],
    });
    const cse = await this.cseDepartment();
    const cseId = cse?.id ?? null;
    return {
      rows: assignments.filter((a) => this.isMovable(a.course, a.week_number, cseId)),
      cseId,
    };
  }

  /**
   * Builds the reschedule plan without writing anything.
   *
   * The plan is always computed from the *original* schedule: when a snapshot
   * exists its values are overlaid on the current rows first, so pressing Apply
   * twice (or ten times) produces the same weeks 11–14 layout instead of
   * shuffling an already-shuffled schedule.
   *
   * Placement rules, per level-term:
   *  - the level-term's group decides which weekdays each week offers;
   *  - one sitting per date, because a level-term sits its class tests as one
   *    cohort — its date has to be unique however the rooms overlap;
   *  - each course's class tests are spread evenly across the dates the window
   *    offers it, in CT order, with no fixed gap;
   *  - when a level-term has more class tests than its own days can hold, the
   *    rest of the window's available dates take the overflow rather than leave
   *    a sitting outside weeks 11–14.
   */
  private async buildPlan(semesterId: string) {
    const [settings, departments, configs, roomMappings, assignments, snapshot] = await Promise.all([
      this.ctSettingRepository.findOne({ where: { semester_id: semesterId } }),
      this.departmentRepository.find(),
      this.ctWeekConfigRepository.find({
        where: { semester_id: semesterId },
        order: { week_number: 'ASC', date: 'ASC' },
      }),
      this.roomMappingRepository.find({ where: { semester_id: semesterId } }),
      this.ctAssignmentRepository.find({
        where: { semester_id: semesterId },
        relations: ['course'],
      }),
      this.snapshotRepository.findOne({ where: { semester_id: semesterId } }),
    ]);

    const cseId = departments.find((d) => d.short_name === 'CSE')?.id ?? null;
    const warnings: string[] = [];

    // The base state the plan is computed from: the rows as they are now, with
    // every movable sitting reset to its snapshot values.
    const snapshotById = new Map((snapshot?.original_assignments ?? []).map((s) => [s.id, s]));
    const base: BaseSitting[] = [];
    for (const a of assignments) {
      if (!a.course) continue;
      const snap = snapshotById.get(a.id);
      base.push({
        id: a.id,
        course_id: a.course_id,
        course: a.course,
        room_ids: snap?.room_ids ?? [...(a.room_ids ?? [])],
        week_number: snap?.week_number ?? a.week_number,
        date: snap?.date ?? CTScheduleService.dateOnly(a.date),
        ct_number: a.ct_number,
      });
    }

    const movable = base.filter((row) => this.isMovable(row.course, row.week_number, cseId));
    if (movable.length === 0) {
      warnings.push(
        'No CSE class tests were found in week 10 or later — there is nothing to reschedule.',
      );
    }

    // Dates already taken by the sittings that are staying put. Movable sittings
    // free their own old dates, so only the others are booked up front.
    const movableIds = new Set(movable.map((m) => m.id));
    const bookedByDate = new Map<string, Set<string>>();
    const book = (date: string, roomIds: string[]) => {
      const set = bookedByDate.get(date) ?? new Set<string>();
      for (const rid of roomIds) set.add(rid);
      bookedByDate.set(date, set);
    };
    for (const row of base) {
      if (movableIds.has(row.id)) continue;
      book(row.date, row.room_ids);
    }

    // Every date the window can use, earliest first. Only dates the CT calendar
    // marks available are considered, so a blackout day is never used.
    const maxWeek = Math.min(RESCHEDULE_LAST_WEEK, settings?.total_weeks ?? RESCHEDULE_LAST_WEEK);
    const windowSlots = configs
      .filter(
        (c) => c.week_number >= RESCHEDULE_FIRST_WEEK && c.week_number <= maxWeek && c.is_available,
      )
      .map((c) => ({ date: CTScheduleService.dateOnly(c.date), week: c.week_number }))
      .sort((a, b) => a.week - b.week || a.date.localeCompare(b.date));

    // …of which each group's own weekdays, so every week keeps the pattern the
    // two groups take turns sitting on.
    const slotsByGroup = new Map<RescheduleGroup, { date: string; week: number }[]>();
    for (const group of [1, 2] as RescheduleGroup[]) {
      slotsByGroup.set(
        group,
        windowSlots.filter((s) =>
          daysForGroup(group, s.week).includes(CTRescheduleService.weekdayCode(s.date)),
        ),
      );
    }

    // Dates a level-term is already committed to. The sittings this reschedule
    // does not move still sit on their day, so a moved sitting of the same
    // level-term can never land on one: one class test per level-term per day is
    // the whole point, whatever department owns the course.
    const blockedByLevelTerm = new Map<string, Set<string>>();
    for (const row of base) {
      if (movableIds.has(row.id)) continue;
      if (!groupForLevelTerm(row.course.level, row.course.term)) continue;
      if (row.week_number < RESCHEDULE_FIRST_WEEK || row.week_number > maxWeek) continue;
      const key = `${row.course.level}|${row.course.term}`;
      const dates = blockedByLevelTerm.get(key) ?? new Set<string>();
      dates.add(row.date);
      blockedByLevelTerm.set(key, dates);
    }

    const roomMappingByBucket = new Map(
      roomMappings.map((m) => [
        `${m.level}|${m.term}|${m.departmental_type}|${m.department_id || ''}`,
        m.room_ids,
      ]),
    );
    const roomsFor = (course: Course, fallback: string[]) => {
      const mapped = roomMappingByBucket.get(
        `${course.level}|${course.term}|${course.departmental_type}|${course.department_id || ''}`,
      );
      return mapped && mapped.length > 0 ? mapped : fallback;
    };

    // Level-terms, in a stable order so the plan never depends on row order.
    const buckets = new Map<string, { group: RescheduleGroup; rows: BaseSitting[] }>();
    for (const row of movable) {
      const group = groupForLevelTerm(row.course.level, row.course.term)!;
      const key = `${group}|${row.course.level}|${row.course.term}`;
      const bucket = buckets.get(key) ?? { group, rows: [] };
      bucket.rows.push(row);
      buckets.set(key, bucket);
    }

    // The same-day clashes the current schedule already has, so the page can
    // show exactly what this reschedule is fixing.
    const conflicts = this.findCollisions(base);

    const shifts: RescheduleShift[] = [];

    const record = (row: BaseSitting, still: { date: string; week: number } | null, note?: string) => {
      const group = groupForLevelTerm(row.course.level, row.course.term)!;
      const unchanged = still !== null && still.date === row.date && still.week === row.week_number;
      shifts.push({
        id: row.id,
        course_id: row.course_id,
        course_code: row.course.code,
        course_name: row.course.name,
        level: row.course.level,
        term: row.course.term,
        group,
        ct_number: row.ct_number,
        room_ids: roomsFor(row.course, row.room_ids),
        old_date: row.date,
        old_week: row.week_number,
        new_date: still?.date ?? row.date,
        new_week: still?.week ?? row.week_number,
        status: still === null ? 'unplaced' : unchanged ? 'unchanged' : 'moved',
        note,
      });
    };

    // Level-terms that fit inside their own group's days go first, so they claim
    // the dates the pattern gives them; the ones that overrun sit afterwards and
    // take what is left. That keeps spills — and the room clashes they cause —
    // down to the minimum the window forces.
    const bucketFits = (b: { group: RescheduleGroup; rows: BaseSitting[] }) =>
      b.rows.length <= (slotsByGroup.get(b.group)?.length ?? 0);

    const orderedBuckets = [...buckets.values()].sort(
      (a, b) =>
        Number(bucketFits(b)) - Number(bucketFits(a)) ||
        b.rows.length - a.rows.length ||
        a.group - b.group ||
        a.rows[0].course.level - b.rows[0].course.level ||
        a.rows[0].course.term.localeCompare(b.rows[0].course.term),
    );

    for (const bucket of orderedBuckets) {
      const sample = bucket.rows[0].course;
      const label = `Level ${sample.level}-${sample.term}`;
      const groupSlots = slotsByGroup.get(bucket.group) ?? [];
      const roomIds = roomsFor(sample, bucket.rows[0].room_ids);
      const blocked = blockedByLevelTerm.get(`${sample.level}|${sample.term}`) ?? new Set<string>();
      const groupDates = new Set(groupSlots.map((s) => s.date));

      // The level-term's own days — its group's weekdays, week by week. Only when
      // they cannot hold every class test do other available dates join in, picked
      // to sit as evenly between the level-term's own days as their number allows,
      // so a test outside weeks 11–14 is never the answer and the gaps stay wide.
      const ownPool = groupSlots.length > 0 ? groupSlots : windowSlots;
      const ownDates = new Set(ownPool.map((s) => s.date));
      const otherSlots =
        groupSlots.length > 0 ? windowSlots.filter((s) => !ownDates.has(s.date)) : [];
      // Overflow dates that no level-term sharing these rooms has taken yet come
      // first, so an overrun lands where it cannot clash whenever such a date
      // exists at all.
      const spareSlots = otherSlots.filter((s) => {
        const taken = bookedByDate.get(s.date);
        return !(taken && roomIds.some((rid) => taken.has(rid)));
      });
      const overflow = bucket.rows.length - ownPool.length;
      const extras = pickSpread(spareSlots.length >= overflow ? spareSlots : otherSlots, overflow);
      const pool = [...ownPool, ...extras].sort((a, b) => a.date.localeCompare(b.date));
      const capacity = pool.length;

      if (capacity === 0) {
        const note = `${label}: no available date in weeks ${RESCHEDULE_FIRST_WEEK}–${maxWeek}`;
        warnings.push(note);
        for (const row of bucket.rows) record(row, null, note);
        continue;
      }

      if (bucket.rows.length > capacity) {
        warnings.push(
          `${label}: ${bucket.rows.length} class tests from week ${RESCHEDULE_FROM_WEEK} on, but only ` +
            `${capacity} dates in weeks ${RESCHEDULE_FIRST_WEEK}–${maxWeek} — at least ` +
            `${bucket.rows.length - capacity} cannot fit`,
        );
      }

      // Dates this level-term has taken. A date is used once per level-term, so
      // two of its courses can never sit at the same time.
      const usedDates = new Set<string>();
      const spilled = new Set<string>();

      /** Whether the level-term can take this date: free for the level-term, not
       *  already held by one of its unmoved sittings, and — unless `sharingRooms`
       *  says the window leaves no choice — not needed by a level-term that uses
       *  the same rooms. */
      const isFree = (slot: { date: string; week: number }, sharingRooms: boolean) => {
        if (usedDates.has(slot.date) || blocked.has(slot.date)) return false;
        if (sharingRooms) return true;
        const taken = bookedByDate.get(slot.date);
        return !(taken && roomIds.some((rid) => taken.has(rid)));
      };

      /** The free date nearest index `ideal`, searching outward so the spread is
       *  kept and the whole list is swept before giving up. With `after` set the
       *  date also has to come after this course's previous class test. */
      const nearest = (ideal: number, after: string, sharingRooms: boolean) => {
        for (let offset = 0; offset < pool.length; offset++) {
          for (const index of [ideal + offset, ideal - offset]) {
            if (index < 0 || index >= pool.length) continue;
            const slot = pool[index];
            if (after && slot.date <= after) continue;
            if (!isFree(slot, sharingRooms)) continue;
            return slot;
          }
        }
        return null;
      };

      // Course → its movable sittings, in CT order.
      const byCourse = new Map<string, { course: Course; rows: BaseSitting[] }>();
      for (const row of bucket.rows) {
        const entry = byCourse.get(row.course_id) ?? { course: row.course, rows: [] };
        entry.rows.push(row);
        byCourse.set(row.course_id, entry);
      }
      // Courses with the most class tests go first: they have the least room to
      // manoeuvre, so they claim their dates before the easier ones fill up.
      const courses = [...byCourse.values()].sort(
        (a, b) => b.rows.length - a.rows.length || a.course.code.localeCompare(b.course.code),
      );
      for (const entry of courses) entry.rows.sort((a, b) => a.ct_number - b.ct_number);

      for (const { course, rows } of courses) {
        // Where each of this course's class tests would ideally go: spread evenly
        // across the dates the level-term's window offers, so the gaps come out as
        // large and as varied as the number of dates allows. No fixed gap is
        // enforced — fitting every class test inside weeks 11–14 comes first, and
        // a rigid two-week step would push a third test past week 14 entirely.
        const span = pool.length;
        const packed = rows.length >= span;
        const ideals: number[] = [];
        for (let k = 0; k < rows.length; k++) {
          let ideal = packed
            ? Math.min(k, span - 1)
            : Math.round(((k + 1) * span) / (rows.length + 1));
          if (k > 0) ideal = Math.max(ideal, ideals[k - 1] + 1);
          ideals.push(Math.min(ideal, span - 1));
        }

        let after = '';
        for (let k = 0; k < rows.length; k++) {
          const row = rows[k];

          // A date no other level-term needs comes first; only when the window has
          // nothing clash-free left does a shared room get accepted. The time
          // order is given up only as a last resort, when no later date is free.
          const slot =
            nearest(ideals[k], after, false) ??
            nearest(ideals[k], after, true) ??
            nearest(ideals[k], '', false) ??
            nearest(ideals[k], '', true);

          if (!slot) {
            // Nothing left at all. Hold this sitting's own date so no other course
            // of the level-term is placed on top of it.
            blocked.add(row.date);
            record(
              row,
              null,
              `${label}: ${course.code} CT${row.ct_number} has no free date left in weeks ` +
                `${RESCHEDULE_FIRST_WEEK}–${maxWeek}`,
            );
            continue;
          }

          usedDates.add(slot.date);
          book(slot.date, roomIds);
          after = slot.date;
          if (!groupDates.has(slot.date)) spilled.add(slot.date);
          record(row, slot);
        }
      }

      if (spilled.size > 0) {
        warnings.push(
          `${label}: more class tests than its group days can hold, so ` +
            `${spilled.size} of them use other available dates inside weeks ` +
            `${RESCHEDULE_FIRST_WEEK}–${maxWeek}.`,
        );
      }
    }

    shifts.sort(
      (a, b) =>
        a.group - b.group ||
        a.level - b.level ||
        a.term.localeCompare(b.term) ||
        a.course_code.localeCompare(b.course_code) ||
        a.ct_number - b.ct_number,
    );

    const weekSlots: { week: number; group: RescheduleGroup; days: string[] }[] = [];
    for (let week = RESCHEDULE_FIRST_WEEK; week <= maxWeek; week++) {
      for (const group of [1, 2] as RescheduleGroup[]) {
        weekSlots.push({ week, group, days: daysForGroup(group, week) });
      }
    }

    // Whatever the plan could not separate stays flagged: a sitting that could
    // not be re-placed keeps its old date, which can leave a level-term with two
    // courses on one day after all.
    const shiftById = new Map(shifts.map((s) => [s.id, s]));
    const resulting = base.map((row) => {
      const shift = shiftById.get(row.id);
      return {
        id: row.id,
        course: row.course,
        date: shift?.new_date ?? row.date,
        week_number: shift?.new_week ?? row.week_number,
        ct_number: row.ct_number,
        room_ids: shift ? shift.room_ids : row.room_ids,
      };
    });
    for (const c of this.findCollisions(resulting, movableIds)) {
      const who = c.courses.map((x) => `${x.course_code} CT${x.ct_number}`).join(', ');
      warnings.push(`Level ${c.level}-${c.term}: ${who} still share ${c.date}`);
    }

    // Room clashes between two level-terms the window could not avoid. They are
    // reported, not warned about: a shared room is less bad than a class test
    // left outside weeks 11–14.
    const overlaps = this.findRoomOverlaps(resulting);

    return {
      from_week: RESCHEDULE_FROM_WEEK,
      first_week: RESCHEDULE_FIRST_WEEK,
      last_week: maxWeek,
      snapshot: snapshot
        ? { created_at: snapshot.created_at, count: snapshot.original_assignments.length }
        : null,
      week_slots: weekSlots,
      conflicts,
      overlaps,
      shifts,
      warnings,
    };
  }

  /** Dry run for the Reschedule CT page — the layout Apply would produce. */
  async getPlan(semesterId: string) {
    this.assertSemester(semesterId);
    return this.buildPlan(semesterId);
  }

  /**
   * Writes the weeks 11–14 layout to `ct_assignments`, so every view (calendar,
   * course, room, teacher) reads the rescheduled dates straight away.
   *
   * The original schedule is snapshotted on the first Apply and reused by every
   * later one, which is what makes this repeatable and what Restore returns to.
   */
  async apply(semesterId: string) {
    this.assertSemester(semesterId);

    let snapshot = await this.snapshotRepository.findOne({ where: { semester_id: semesterId } });
    if (!snapshot) {
      const { rows } = await this.loadCurrentMovable(semesterId);
      const original: CTSnapshotAssignment[] = rows.map((a) => ({
        id: a.id,
        course_id: a.course_id,
        room_ids: [...(a.room_ids ?? [])],
        week_number: a.week_number,
        date: CTScheduleService.dateOnly(a.date),
        ct_number: a.ct_number,
      }));
      snapshot = await this.snapshotRepository.save(
        this.snapshotRepository.create({
          semester_id: semesterId,
          original_assignments: original,
        }),
      );
    }

    const plan = await this.buildPlan(semesterId);
    const placed = plan.shifts.filter((s) => s.status === 'moved');
    const unplaced = plan.shifts.filter((s) => s.status === 'unplaced');

    // Compared against what the rows hold right now, not the plan's "before"
    // column: an earlier Apply (or a hand edit) may have left a row somewhere
    // else, and it still has to converge on the plan.
    const stored = new Map(
      (
        await this.ctAssignmentRepository.find({ where: { semester_id: semesterId } })
      ).map((a) => [a.id, { date: CTScheduleService.dateOnly(a.date), week_number: a.week_number }]),
    );

    await this.ctAssignmentRepository.manager.transaction(async (manager) => {
      for (const shift of plan.shifts) {
        const now = stored.get(shift.id);
        if (now && now.date === shift.new_date && now.week_number === shift.new_week) continue;
        await manager.update(CTAssignment, shift.id, {
          date: shift.new_date as unknown as Date,
          week_number: shift.new_week,
        });
      }

      // The generated dates have to stay pickable in the edit dialogs afterwards.
      const usedDates = [...new Set(placed.map((s) => s.new_date))];
      if (usedDates.length > 0) {
        await manager.update(
          CTWeekConfig,
          { semester_id: semesterId, date: In(usedDates as unknown as Date[]) },
          { is_available: true },
        );
      }
    });

    return {
      applied: placed.length,
      unplaced: unplaced.length,
      warnings: plan.warnings,
      plan: await this.buildPlan(semesterId),
      assignments: await this.listAssignments(semesterId),
    };
  }

  /** Puts every movable sitting back where it was before the first Apply and
   *  drops the snapshot, returning the semester to its pristine CT schedule. */
  async restore(semesterId: string) {
    this.assertSemester(semesterId);

    const snapshot = await this.snapshotRepository.findOne({ where: { semester_id: semesterId } });
    if (!snapshot) {
      throw new ConflictException('There is no saved CT schedule to restore.');
    }

    const rows = snapshot.original_assignments ?? [];
    await this.ctAssignmentRepository.manager.transaction(async (manager) => {
      for (const row of rows) {
        await manager.update(CTAssignment, row.id, {
          date: row.date as unknown as Date,
          week_number: row.week_number,
          room_ids: row.room_ids,
        });
      }
      await manager.delete(CTRescheduleSnapshot, { semester_id: semesterId });
    });

    return {
      restored: rows.length,
      assignments: await this.listAssignments(semesterId),
    };
  }
}
