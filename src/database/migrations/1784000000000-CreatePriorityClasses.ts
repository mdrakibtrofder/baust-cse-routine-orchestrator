import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePriorityClasses1784000000000 implements MigrationInterface {
  name = 'CreatePriorityClasses1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "priority_classes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "semester_id" uuid NOT NULL,
        "department_id" uuid NOT NULL,
        "level" integer NOT NULL,
        "term" varchar(10) NOT NULL,
        "section_id" uuid NOT NULL,
        "course_ids" uuid[] NOT NULL DEFAULT array[]::uuid[],
        "room_ids" uuid[] NOT NULL DEFAULT array[]::uuid[],
        "time_slots" jsonb,
        "days" varchar[] NOT NULL DEFAULT array[]::varchar[],
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_priority_classes_semester" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_priority_classes_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_priority_classes_section" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_priority_classes_semester" ON "priority_classes"("semester_id");
      CREATE INDEX "IDX_priority_classes_semester_dept" ON "priority_classes"("semester_id", "department_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_priority_classes_semester_dept"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_priority_classes_semester"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "priority_classes"`);
  }
}
