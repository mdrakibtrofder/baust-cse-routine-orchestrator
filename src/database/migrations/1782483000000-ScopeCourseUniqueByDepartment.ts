import { MigrationInterface, QueryRunner } from "typeorm";

export class ScopeCourseUniqueByDepartment1782483000000 implements MigrationInterface {
    name = 'ScopeCourseUniqueByDepartment1782483000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_courses_code_level_term_dept"
        `);
        await queryRunner.query(`
            ALTER TABLE "courses"
            DROP CONSTRAINT IF EXISTS "IDX_courses_code_level_term_dept"
        `);

        const indexExists = await queryRunner.query(`
            SELECT 1 FROM pg_indexes
            WHERE indexname = 'IDX_courses_code_level_term_dept' AND tablename = 'courses'
        `);
        if (indexExists.length === 0) {
            // department_id is nullable; in Postgres NULL values are never considered
            // equal for UNIQUE purposes, so two courses with the same code/level/term/
            // departmental_type but both NULL department_id won't collide here. That's
            // fine — non-departmental / unassigned courses fall back to the looser rule.
            await queryRunner.query(`
                CREATE UNIQUE INDEX "IDX_courses_code_level_term_dept"
                ON "courses" (code, level, term, departmental_type, department_id)
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_courses_code_level_term_dept"
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_courses_code_level_term_dept"
            ON "courses" (code, level, term, departmental_type)
        `);
    }
}
