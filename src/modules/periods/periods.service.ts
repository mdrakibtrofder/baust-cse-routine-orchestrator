import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Period } from '../../entities/period.entity';
import { CreatePeriodDto } from '../../dtos/period.dto';
import { UpdatePeriodDto } from '../../dtos/update-dtos/update-period.dto';

@Injectable()
export class PeriodsService {
  constructor(
    @InjectRepository(Period)
    private readonly periodRepository: Repository<Period>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(kind?: 'theory' | 'sessional') {
    const where: any = {};
    if (kind) where.kind = kind;
    return this.periodRepository.find({ where, order: { start: 'ASC' } });
  }

  async findById(id: string) {
    const period = await this.periodRepository.findOne({ where: { id } });
    if (!period) throw new NotFoundException(`Period with ID ${id} not found`);
    return period;
  }

  async create(dto: CreatePeriodDto) {
    const period = this.periodRepository.create(dto);
    return this.periodRepository.save(period);
  }

  /**
   * Updates a period and, when its time changes, carries every class sitting on the
   * old time across to the new one.
   *
   * A class slot's start/end is only ever a copy of some period's start/end — the
   * schedule modal writes `period.start`/`period.end` and the generator does the
   * same. Editing a period without moving those copies therefore strands every
   * class that used it: the slot still reads e.g. 08:00–08:50 while the only
   * period that exists now reads 08:00–08:55, so nothing in the UI can match the
   * two. That is what leaves the Theory/Sessional Timeslot dropdown blank when the
   * schedule modal opens such a class, and it is why times that were never entered
   * by hand can still look illogical.
   *
   * Only slots of the period's own kind move. A theory period and a sessional
   * period may legitimately share a time range, and shifting one must not drag the
   * other's classes along with it; a slot's kind is its course's `course_type`
   * prefix, which is where the join to `courses` comes from.
   */
  async update(id: string, dto: UpdatePeriodDto) {
    const period = await this.findById(id);
    const oldStart = period.start;
    const oldEnd = period.end;
    // Match on the kind the period had *before* the edit: those are the classes
    // that were sitting in it. (The settings UI only edits start/end, but the
    // endpoint accepts a kind change and it must not re-target other classes.)
    const oldKind = period.kind;

    return this.dataSource.transaction(async (manager) => {
      Object.assign(period, dto);
      const saved = await manager.save(Period, period);

      const timeChanged = saved.start !== oldStart || saved.end !== oldEnd;
      if (timeChanged) {
        await manager.query(
          `UPDATE "class_slots" AS cs
              SET "start" = $1, "end" = $2
             FROM "courses" AS c
            WHERE cs."course_id" = c."id"
              AND cs."start" = $3::time
              AND cs."end" = $4::time
              AND c."course_type" LIKE $5`,
          [saved.start, saved.end, oldStart, oldEnd, `${oldKind}%`],
        );
      }

      return saved;
    });
  }

  async delete(id: string) {
    const period = await this.findById(id);
    await this.periodRepository.remove(period);
    return { success: true };
  }
}
