import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1714400000000 implements MigrationInterface {
    name = 'InitialSchema1714400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Semesters Table
        await queryRunner.query(`
            CREATE TABLE "semesters" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar(100) NOT NULL,
                "year" integer NOT NULL,
                "season" varchar(20) NOT NULL CHECK (season IN ('Winter', 'Summer')),
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Teachers Table
        await queryRunner.query(`
            CREATE TABLE "teachers" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "short_name" varchar(50) NOT NULL UNIQUE,
                "name" varchar(200) NOT NULL,
                "designation" varchar(100) NOT NULL,
                "department" varchar(100) NOT NULL,
                "status" varchar(100) DEFAULT '',
                "assigned_credit" numeric(5,2) NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Rooms Table
        await queryRunner.query(`
            CREATE TABLE "rooms" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar(100) NOT NULL UNIQUE,
                "room_type" varchar(20) NOT NULL CHECK (room_type IN ('Theory', 'Sessional')),
                "capacity" integer NOT NULL CHECK (capacity > 0),
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Sections Table
        await queryRunner.query(`
            CREATE TABLE "sections" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "level" integer NOT NULL CHECK (level > 0),
                "term" varchar(10) NOT NULL CHECK (term IN ('I', 'II')),
                "name" varchar(50) NOT NULL,
                "total_students" integer NOT NULL CHECK (total_students > 0),
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(level, term, name)
            )
        `);

        // Courses Table
        await queryRunner.query(`
            CREATE TABLE "courses" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "code" varchar(50) NOT NULL,
                "name" varchar(200) NOT NULL,
                "credit" numeric(3,2) NOT NULL CHECK (credit > 0),
                "course_type" varchar(20) NOT NULL CHECK (course_type IN ('theory_2.0', 'theory_3.0', 'sessional_1.5', 'sessional_0.75')),
                "level" integer NOT NULL CHECK (level > 0),
                "term" varchar(10) NOT NULL CHECK (term IN ('I', 'II')),
                "theory" numeric(3,2) NOT NULL DEFAULT 0,
                "sessional" numeric(3,2) NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(code, level, term)
            )
        `);

        // Periods Table
        await queryRunner.query(`
            CREATE TABLE "periods" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar(100) NOT NULL,
                "start" TIME NOT NULL,
                "end" TIME NOT NULL,
                "duration" integer NOT NULL CHECK (duration > 0),
                "kind" varchar(20) NOT NULL CHECK (kind IN ('theory', 'sessional')),
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Days Table
        await queryRunner.query(`
            CREATE TABLE "days" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar(50) NOT NULL UNIQUE,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Course Section Teachers Table
        await queryRunner.query(`
            CREATE TABLE "course_section_teachers" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "semester_id" uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
                "course_id" uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                "section_id" uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                "teacher_ids" uuid[] NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(semester_id, course_id, section_id)
            )
        `);

        // Class Slots Table
        await queryRunner.query(`
            CREATE TABLE "class_slots" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "semester_id" uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
                "course_id" uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                "section_id" uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                "room_id" uuid REFERENCES rooms(id) ON DELETE SET NULL,
                "day" varchar(50) NOT NULL,
                "start" TIME NOT NULL,
                "end" TIME NOT NULL,
                "week" varchar(20) NOT NULL CHECK (week IN ('EVERY', 'EVEN', 'ODD')) DEFAULT 'EVERY',
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (semester_id, course_id, section_id) REFERENCES course_section_teachers(semester_id, course_id, section_id)
            )
        `);

        // Create Indexes
        await queryRunner.query(`CREATE INDEX "idx_class_slots_semester" ON "class_slots"("semester_id")`);
        await queryRunner.query(`CREATE INDEX "idx_class_slots_course" ON "class_slots"("course_id")`);
        await queryRunner.query(`CREATE INDEX "idx_class_slots_section" ON "class_slots"("section_id")`);
        await queryRunner.query(`CREATE INDEX "idx_class_slots_room" ON "class_slots"("room_id")`);
        await queryRunner.query(`CREATE INDEX "idx_course_section_teachers_semester" ON "course_section_teachers"("semester_id")`);
        await queryRunner.query(`CREATE INDEX "idx_course_section_teachers_composite" ON "course_section_teachers"("semester_id", "course_id", "section_id")`);
        await queryRunner.query(`CREATE INDEX "idx_courses_level_term" ON "courses"("level", "term")`);
        await queryRunner.query(`CREATE INDEX "idx_sections_level_term" ON "sections"("level", "term")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "class_slots"`);
        await queryRunner.query(`DROP TABLE "course_section_teachers"`);
        await queryRunner.query(`DROP TABLE "days"`);
        await queryRunner.query(`DROP TABLE "periods"`);
        await queryRunner.query(`DROP TABLE "courses"`);
        await queryRunner.query(`DROP TABLE "sections"`);
        await queryRunner.query(`DROP TABLE "rooms"`);
        await queryRunner.query(`DROP TABLE "teachers"`);
        await queryRunner.query(`DROP TABLE "semesters"`);
    }
}
