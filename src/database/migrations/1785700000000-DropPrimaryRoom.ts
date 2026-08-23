import { MigrationInterface, QueryRunner } from 'typeorm';

/** Removes the "primary room" concept.
 *
 *  A primary room was a per-assignment room preference set on Course Load and on
 *  the Room & Time Mapping page's "Course vs Room" tab, separate from the room
 *  each class slot actually carries. It duplicated information the schedule
 *  already holds — the slot's own `room_id` — and the two could disagree, so the
 *  column is dropped from both tables that carried it.
 *
 *  Postgres drops any foreign key involving a column when that column is dropped,
 *  so the FKs to `rooms` need no separate statement. */
export class DropPrimaryRoom1785700000000 implements MigrationInterface {
  name = 'DropPrimaryRoom1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_section_teachers" DROP COLUMN IF EXISTS "primary_room_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_lab_sections" DROP COLUMN IF EXISTS "primary_room_id"`,
    );
  }

  /** Restores the columns and their FKs. The values themselves are gone for good —
   *  a preference that no longer exists anywhere in the app cannot be reconstructed. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_section_teachers" ADD COLUMN IF NOT EXISTS "primary_room_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_section_teachers"
         ADD CONSTRAINT "FK_course_section_teachers_primary_room"
         FOREIGN KEY ("primary_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_lab_sections" ADD COLUMN IF NOT EXISTS "primary_room_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_lab_sections"
         ADD CONSTRAINT "FK_course_lab_sections_room"
         FOREIGN KEY ("primary_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL`,
    );
  }
}
