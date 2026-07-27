import { MigrationInterface, QueryRunner } from 'typeorm';

export class CTLevelTermMappingsAndDropCTSection1785500000000 implements MigrationInterface {
  name = 'CTLevelTermMappingsAndDropCTSection1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // New: level-term -> weekday(s) mapping for CT generation. Independent of
    // the semester-wide holiday/blackout calendar in ct_week_configs.
    await queryRunner.query(`
      CREATE TABLE "ct_level_term_day_mappings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "semester_id" uuid NOT NULL,
        "level" integer NOT NULL,
        "term" varchar(10) NOT NULL,
        "departmental_type" varchar(20) NOT NULL DEFAULT 'Departmental',
        "department_id" uuid,
        "days" varchar[] NOT NULL DEFAULT array[]::varchar[],
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_ct_level_term_day_mappings_semester" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ct_level_term_day_mappings_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_ct_level_term_day_mappings_bucket"
      ON "ct_level_term_day_mappings" ("semester_id", "level", "term", "departmental_type", "department_id")
    `);

    // New: level-term -> room(s) mapping. A level-term can map to multiple
    // rooms so more than one course at that level-term can test in parallel.
    await queryRunner.query(`
      CREATE TABLE "ct_level_term_room_mappings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "semester_id" uuid NOT NULL,
        "level" integer NOT NULL,
        "term" varchar(10) NOT NULL,
        "departmental_type" varchar(20) NOT NULL DEFAULT 'Departmental',
        "department_id" uuid,
        "room_ids" uuid[] NOT NULL DEFAULT array[]::uuid[],
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_ct_level_term_room_mappings_semester" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ct_level_term_room_mappings_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_ct_level_term_room_mappings_bucket"
      ON "ct_level_term_room_mappings" ("semester_id", "level", "term", "departmental_type", "department_id")
    `);

    // Drop section_id from ct_assignments — CT scheduling is level-term-wide
    // now (a level-term's day/room mapping already implies every section at
    // that level-term tests together), so there's nothing left to key on per
    // section. Existing rows are cleared since the whole generation algorithm
    // (and thus the shape of an assignment) is changing; DROP COLUMN cascades
    // to drop the section_id FK, the old composite UNIQUE(semester_id,
    // course_id, section_id, ct_number) constraint, and the
    // idx_ct_assignments_course_section index automatically — all were
    // created inline/implicitly with Postgres-assigned default names in the
    // original AddCTSchedule migration, so there's nothing to name here.
    await queryRunner.query(`DELETE FROM "ct_assignments"`);
    await queryRunner.query(`ALTER TABLE "ct_assignments" DROP COLUMN IF EXISTS "section_id"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_ct_assignments_semester_course_ct_number"
      ON "ct_assignments" ("semester_id", "course_id", "ct_number")
    `);

    // Drop start_week from ct_settings — "Map Available Days" no longer
    // filters by a start week; all configured weeks are shown.
    await queryRunner.query(`ALTER TABLE "ct_settings" DROP COLUMN IF EXISTS "start_week"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ct_settings" ADD "start_week" integer NOT NULL DEFAULT 4`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ct_assignments_semester_course_ct_number"`);
    await queryRunner.query(`DELETE FROM "ct_assignments"`);
    await queryRunner.query(`ALTER TABLE "ct_assignments" ADD COLUMN "section_id" uuid REFERENCES "sections"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "ct_assignments" ALTER COLUMN "section_id" SET NOT NULL`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "ct_assignments_semester_id_course_id_section_id_ct_number_key"
      ON "ct_assignments" ("semester_id", "course_id", "section_id", "ct_number")
    `);
    await queryRunner.query(`CREATE INDEX "idx_ct_assignments_course_section" ON "ct_assignments" ("course_id", "section_id")`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ct_level_term_room_mappings_bucket"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ct_level_term_room_mappings"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ct_level_term_day_mappings_bucket"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ct_level_term_day_mappings"`);
  }
}
