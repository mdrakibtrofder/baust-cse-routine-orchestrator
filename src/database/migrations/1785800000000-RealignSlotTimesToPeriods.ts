import { MigrationInterface, QueryRunner } from 'typeorm';

/** Repairs class slots whose time drifted away from every configured period.
 *
 *  A slot's start/end is only ever a copy of some period's start/end. Until the
 *  accompanying fix in `PeriodsService.update`, editing a period changed the
 *  period row alone and left every class that used it behind — a period moved
 *  from 08:00–08:50 to 08:00–08:55 stranded its classes at 08:50, matching no
 *  period at all. Those classes render a blank Theory/Sessional Timeslot
 *  dropdown and show times nobody ever entered.
 *
 *  The repair is deliberately narrow. A slot is only moved when it matches no
 *  period at all *and* exactly one period of its own kind starts at the same
 *  time; that slot then adopts that period's end. Anything ambiguous — no
 *  same-start period, or several — is left untouched for a human to look at,
 *  because guessing at a class's time is worse than leaving it visibly odd. */
export class RealignSlotTimesToPeriods1785800000000 implements MigrationInterface {
  name = 'RealignSlotTimesToPeriods1785800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ id: string; start: string; old_end: string; new_end: string }> =
      await queryRunner.query(`
        WITH orphan AS (
          SELECT cs."id", cs."start", cs."end",
                 CASE WHEN c."course_type" LIKE 'sessional%' THEN 'sessional' ELSE 'theory' END AS kind
            FROM "class_slots" cs
            JOIN "courses" c ON c."id" = cs."course_id"
           WHERE NOT EXISTS (
                   SELECT 1 FROM "periods" p
                    WHERE p."start" = cs."start" AND p."end" = cs."end"
                 )
        ),
        candidate AS (
          SELECT o."id", o."start", o."end" AS old_end,
                 MIN(p."end") AS new_end,
                 COUNT(*)     AS matches
            FROM orphan o
            JOIN "periods" p
              ON p."start" = o."start"
             AND p."kind"  = o.kind
             AND p."is_break" = false
           GROUP BY o."id", o."start", o."end"
        )
        SELECT "id", "start", old_end, new_end
          FROM candidate
         WHERE matches = 1
      `);

    if (rows.length === 0) {
      console.log('[RealignSlotTimesToPeriods] No drifted class slots found.');
      return;
    }

    await queryRunner.query(
      `UPDATE "class_slots" SET "end" = v.new_end::time
         FROM (VALUES ${rows.map((_, i) => `($${i * 2 + 1}::uuid, $${i * 2 + 2})`).join(', ')})
              AS v(id, new_end)
        WHERE "class_slots"."id" = v.id`,
      rows.flatMap((r) => [r.id, r.new_end]),
    );

    for (const r of rows) {
      console.log(
        `[RealignSlotTimesToPeriods] slot ${r.id}: ${r.start}–${r.old_end} -> ${r.start}–${r.new_end}`,
      );
    }
    console.log(`[RealignSlotTimesToPeriods] Realigned ${rows.length} class slot(s).`);
  }

  /** Not reversible: the drifted times were themselves the corruption, and the
   *  originals carry no information worth restoring. */
  public async down(): Promise<void> {
    // no-op
  }
}
