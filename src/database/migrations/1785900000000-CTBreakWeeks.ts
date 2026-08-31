import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds break weeks (e.g. mid term) to the CT calendar.
 *
 *  `break_weeks` holds the week numbers a break week sits *before*: `{8}` means
 *  the calendar week that would have carried week 8 is the mid-term break, so
 *  weeks 8 and up each fall one calendar week later. Nothing is renumbered — the
 *  column only shifts the dates the configuration grid derives, and existing
 *  class tests are re-anchored to the new dates when the calendar is saved. */
export class CTBreakWeeks1785900000000 implements MigrationInterface {
  name = 'CTBreakWeeks1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ct_settings" ADD COLUMN IF NOT EXISTS "break_weeks" integer array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ct_settings" DROP COLUMN IF EXISTS "break_weeks"`);
  }
}
