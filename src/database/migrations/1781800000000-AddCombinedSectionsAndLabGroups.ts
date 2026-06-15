import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCombinedSectionsAndLabGroups1781800000000 implements MigrationInterface {
  name = 'AddCombinedSectionsAndLabGroups1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add combined_section_ids to course_section_teachers
    await queryRunner.query(`
      ALTER TABLE "course_section_teachers"
      ADD COLUMN IF NOT EXISTS "combined_section_ids" uuid[] DEFAULT NULL
    `);

    // Add lab_group_id to class_slots
    await queryRunner.query(`
      ALTER TABLE "class_slots"
      ADD COLUMN IF NOT EXISTS "lab_group_id" uuid DEFAULT NULL
    `);

    // Create course_lab_groups table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_lab_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "semester_id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "label" varchar(20) NOT NULL,
        "section_id" uuid NOT NULL,
        "teacher_ids" uuid[] NOT NULL DEFAULT array[]::uuid[],
        "primary_room_id" uuid DEFAULT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_lab_groups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_course_lab_groups_semester_course_label"
          UNIQUE ("semester_id", "course_id", "label"),
        CONSTRAINT "FK_course_lab_groups_semester"
          FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_course_lab_groups_course"
          FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_course_lab_groups_section"
          FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_course_lab_groups_room"
          FOREIGN KEY ("primary_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_course_lab_groups_semester_course"
      ON "course_lab_groups" ("semester_id", "course_id")
    `);

    // Add FK from class_slots.lab_group_id to course_lab_groups
    await queryRunner.query(`
      ALTER TABLE "class_slots"
      ADD CONSTRAINT "FK_class_slots_lab_group"
        FOREIGN KEY ("lab_group_id") REFERENCES "course_lab_groups"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "class_slots" DROP CONSTRAINT IF EXISTS "FK_class_slots_lab_group"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_course_lab_groups_semester_course"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_lab_groups"`);
    await queryRunner.query(`ALTER TABLE "class_slots" DROP COLUMN IF EXISTS "lab_group_id"`);
    await queryRunner.query(`ALTER TABLE "course_section_teachers" DROP COLUMN IF EXISTS "combined_section_ids"`);
  }
}
