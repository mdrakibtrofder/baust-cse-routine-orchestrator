import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameLabGroupsToLabSections1782487000000 implements MigrationInterface {
  name = 'RenameLabGroupsToLabSections1782487000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== class_slots: lab_group_id -> lab_section_id, section_id becomes nullable =====
    await queryRunner.query(`
      ALTER TABLE "class_slots" DROP CONSTRAINT IF EXISTS "FK_class_slots_lab_group"
    `);
    await queryRunner.query(`
      ALTER TABLE "class_slots" RENAME COLUMN "lab_group_id" TO "lab_section_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "class_slots" ALTER COLUMN "section_id" DROP NOT NULL
    `);

    // ===== course_lab_groups -> course_lab_sections, section_id (uuid) -> section_ids (uuid[]) =====
    const tableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'course_lab_groups'
    `);
    if (tableExists.length > 0) {
      await queryRunner.query(`ALTER TABLE "course_lab_groups" DROP CONSTRAINT IF EXISTS "FK_course_lab_groups_section"`);
      await queryRunner.query(`ALTER TABLE "course_lab_groups" DROP CONSTRAINT IF EXISTS "FK_course_lab_groups_semester"`);
      await queryRunner.query(`ALTER TABLE "course_lab_groups" DROP CONSTRAINT IF EXISTS "FK_course_lab_groups_course"`);
      await queryRunner.query(`ALTER TABLE "course_lab_groups" DROP CONSTRAINT IF EXISTS "FK_course_lab_groups_room"`);
      await queryRunner.query(`ALTER TABLE "course_lab_groups" DROP CONSTRAINT IF EXISTS "UQ_course_lab_groups_semester_course_label"`);

      // Convert the single section_id column into a section_ids array, preserving existing data.
      await queryRunner.query(`
        ALTER TABLE "course_lab_groups" ADD COLUMN IF NOT EXISTS "section_ids" uuid[] NOT NULL DEFAULT array[]::uuid[]
      `);
      await queryRunner.query(`
        UPDATE "course_lab_groups" SET "section_ids" = ARRAY["section_id"] WHERE "section_id" IS NOT NULL
      `);
      await queryRunner.query(`ALTER TABLE "course_lab_groups" DROP COLUMN IF EXISTS "section_id"`);

      await queryRunner.query(`ALTER TABLE "course_lab_groups" RENAME TO "course_lab_sections"`);
      await queryRunner.query(`ALTER TABLE "course_lab_sections" RENAME CONSTRAINT "PK_course_lab_groups" TO "PK_course_lab_sections"`);

      await queryRunner.query(`
        ALTER TABLE "course_lab_sections"
          ADD CONSTRAINT "UQ_course_lab_sections_semester_course_label" UNIQUE ("semester_id", "course_id", "label"),
          ADD CONSTRAINT "FK_course_lab_sections_semester" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE,
          ADD CONSTRAINT "FK_course_lab_sections_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE,
          ADD CONSTRAINT "FK_course_lab_sections_room" FOREIGN KEY ("primary_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL
      `);

      await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_course_lab_groups_semester_course" RENAME TO "IDX_course_lab_sections_semester_course"`);
    }

    await queryRunner.query(`
      ALTER TABLE "class_slots"
      ADD CONSTRAINT "FK_class_slots_lab_section"
        FOREIGN KEY ("lab_section_id") REFERENCES "course_lab_sections"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "class_slots" DROP CONSTRAINT IF EXISTS "FK_class_slots_lab_section"`);

    await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_course_lab_sections_semester_course" RENAME TO "IDX_course_lab_groups_semester_course"`);
    await queryRunner.query(`
      ALTER TABLE "course_lab_sections"
        DROP CONSTRAINT IF EXISTS "UQ_course_lab_sections_semester_course_label",
        DROP CONSTRAINT IF EXISTS "FK_course_lab_sections_semester",
        DROP CONSTRAINT IF EXISTS "FK_course_lab_sections_course",
        DROP CONSTRAINT IF EXISTS "FK_course_lab_sections_room"
    `);
    await queryRunner.query(`ALTER TABLE "course_lab_sections" RENAME CONSTRAINT "PK_course_lab_sections" TO "PK_course_lab_groups"`);
    await queryRunner.query(`ALTER TABLE "course_lab_sections" RENAME TO "course_lab_groups"`);
    await queryRunner.query(`ALTER TABLE "course_lab_groups" ADD COLUMN IF NOT EXISTS "section_id" uuid`);
    await queryRunner.query(`UPDATE "course_lab_groups" SET "section_id" = "section_ids"[1]`);
    await queryRunner.query(`ALTER TABLE "course_lab_groups" ALTER COLUMN "section_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "course_lab_groups" DROP COLUMN IF EXISTS "section_ids"`);
    await queryRunner.query(`
      ALTER TABLE "course_lab_groups"
        ADD CONSTRAINT "UQ_course_lab_groups_semester_course_label" UNIQUE ("semester_id", "course_id", "label"),
        ADD CONSTRAINT "FK_course_lab_groups_semester" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "FK_course_lab_groups_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "FK_course_lab_groups_section" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "FK_course_lab_groups_room" FOREIGN KEY ("primary_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`ALTER TABLE "class_slots" ALTER COLUMN "section_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "class_slots" RENAME COLUMN "lab_section_id" TO "lab_group_id"`);
    await queryRunner.query(`
      ALTER TABLE "class_slots"
      ADD CONSTRAINT "FK_class_slots_lab_group"
        FOREIGN KEY ("lab_group_id") REFERENCES "course_lab_groups"("id") ON DELETE CASCADE
    `);
  }
}
