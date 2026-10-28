import { MigrationInterface, QueryRunner } from 'typeorm';

/** Snapshot table backing the Reschedule CT feature.
 *
 *  Holds the pre-reschedule state of the movable class tests — the CSE
 *  level-term sittings from week 10 onwards — so the Reschedule CT page can
 *  re-plan weeks 11–14 repeatedly and still restore the original schedule in one
 *  click. One row per semester; it is written on the first Apply and deleted on
 *  Restore (or when the whole CT schedule is regenerated). */
export class CTRescheduleSnapshots1786200000000 implements MigrationInterface {
  name = 'CTRescheduleSnapshots1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ct_reschedule_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "semester_id" uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
        "original_assignments" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(semester_id)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ct_reschedule_snapshots"`);
  }
}
