import { MigrationInterface, QueryRunner } from 'typeorm';

/** Turns CT break weeks into named entries.
 *
 *  The first cut stored `break_weeks integer[]` — a bare list of week numbers,
 *  which could only ever mean "mid term" and could not hold two breaks before
 *  the same week. `breaks` replaces it with `[{ before_week, name }]`, so a
 *  semester can carry an Eid break, a university holiday and a mid term at once,
 *  each labelled, and several before the same week number.
 *
 *  Existing rows are carried over as "Mid Term Break", which is what the integer
 *  column meant in practice. */
export class CTNamedBreakWeeks1786100000000 implements MigrationInterface {
  name = 'CTNamedBreakWeeks1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ct_settings" ADD COLUMN IF NOT EXISTS "breaks" jsonb NOT NULL DEFAULT '[]'`,
    );

    const hasOld: { exists: boolean }[] = await queryRunner.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'ct_settings' AND column_name = 'break_weeks'
       ) AS "exists"`,
    );
    if (hasOld[0]?.exists) {
      await queryRunner.query(
        `UPDATE "ct_settings"
            SET "breaks" = COALESCE(
              (SELECT jsonb_agg(jsonb_build_object('before_week', w, 'name', 'Mid Term Break') ORDER BY w)
                 FROM unnest("break_weeks") AS w),
              '[]'::jsonb
            )
          WHERE "break_weeks" IS NOT NULL AND array_length("break_weeks", 1) > 0`,
      );
      await queryRunner.query(`ALTER TABLE "ct_settings" DROP COLUMN "break_weeks"`);
    }
  }

  /** Restores the integer column, keeping the week numbers and losing the names —
   *  a bare integer array has nowhere to put them. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ct_settings" ADD COLUMN IF NOT EXISTS "break_weeks" integer array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `UPDATE "ct_settings"
          SET "break_weeks" = COALESCE(
            (SELECT array_agg((b->>'before_week')::int ORDER BY (b->>'before_week')::int)
               FROM jsonb_array_elements("breaks") AS b),
            '{}'::int[]
          )`,
    );
    await queryRunner.query(`ALTER TABLE "ct_settings" DROP COLUMN IF EXISTS "breaks"`);
  }
}
