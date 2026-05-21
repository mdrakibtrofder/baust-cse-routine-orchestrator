import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCTSchedule1779386811000 implements MigrationInterface {
    name = 'AddCTSchedule1779386811000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // CT Settings Table
        await queryRunner.query(`
            CREATE TABLE "ct_settings" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "semester_id" uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
                "total_weeks" integer NOT NULL DEFAULT 14,
                "start_date" date,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(semester_id)
            )
        `);

        // CT Week Configs Table
        await queryRunner.query(`
            CREATE TABLE "ct_week_configs" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "semester_id" uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
                "week_number" integer NOT NULL,
                "date" date NOT NULL,
                "is_available" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(semester_id, week_number, date)
            )
        `);

        // CT Assignments Table
        await queryRunner.query(`
            CREATE TABLE "ct_assignments" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "semester_id" uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
                "course_id" uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                "section_id" uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                "room_id" uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                "week_number" integer NOT NULL,
                "date" date NOT NULL,
                "ct_number" integer NOT NULL,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(semester_id, course_id, section_id, ct_number)
            )
        `);

        // Create Indexes
        await queryRunner.query(`CREATE INDEX "idx_ct_week_configs_semester" ON "ct_week_configs"("semester_id")`);
        await queryRunner.query(`CREATE INDEX "idx_ct_assignments_semester" ON "ct_assignments"("semester_id")`);
        await queryRunner.query(`CREATE INDEX "idx_ct_assignments_course_section" ON "ct_assignments"("course_id", "section_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "ct_assignments"`);
        await queryRunner.query(`DROP TABLE "ct_week_configs"`);
        await queryRunner.query(`DROP TABLE "ct_settings"`);
    }
}
