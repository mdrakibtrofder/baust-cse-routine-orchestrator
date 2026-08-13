import { MigrationInterface, QueryRunner } from 'typeorm';

/** A class test now occupies *every* room mapped to its level-term rather than a
 *  single room: the whole cohort sits the test at once, spread across the mapped
 *  rooms. So `ct_assignments.room_id` becomes `room_ids uuid[]`.
 *
 *  Existing rows are backfilled from the old single room so nothing is lost, but
 *  the schedule should be regenerated afterwards — the placement rules changed
 *  (one course per level-term per date), and backfilled rows still reflect the
 *  old one-room-per-CT layout. */
export class CTAssignmentMultiRoom1785600000000 implements MigrationInterface {
  name = 'CTAssignmentMultiRoom1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ct_assignments" ADD COLUMN IF NOT EXISTS "room_ids" uuid[] NOT NULL DEFAULT array[]::uuid[]`,
    );
    // Backfill: the previously assigned single room becomes a one-element array.
    await queryRunner.query(
      `UPDATE "ct_assignments" SET "room_ids" = ARRAY["room_id"]::uuid[] WHERE "room_id" IS NOT NULL`,
    );
    // DROP COLUMN cascades to the room_id foreign key created inline in the
    // original AddCTSchedule migration.
    await queryRunner.query(`ALTER TABLE "ct_assignments" DROP COLUMN IF EXISTS "room_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ct_assignments" ADD COLUMN "room_id" uuid REFERENCES "rooms"("id") ON DELETE CASCADE`,
    );
    // Collapse back to the first mapped room; rows without any room are dropped
    // because room_id was NOT NULL before.
    await queryRunner.query(
      `UPDATE "ct_assignments" SET "room_id" = "room_ids"[1] WHERE array_length("room_ids", 1) >= 1`,
    );
    await queryRunner.query(`DELETE FROM "ct_assignments" WHERE "room_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "ct_assignments" ALTER COLUMN "room_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "ct_assignments" DROP COLUMN IF EXISTS "room_ids"`);
  }
}
