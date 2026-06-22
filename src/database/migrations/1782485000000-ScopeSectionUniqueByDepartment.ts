import { MigrationInterface, QueryRunner } from "typeorm";

export class ScopeSectionUniqueByDepartment1782485000000 implements MigrationInterface {
    name = 'ScopeSectionUniqueByDepartment1782485000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop whatever unique constraint currently covers (level, term, name) on sections —
        // it was created inline (`UNIQUE(level, term, name)`) so Postgres auto-named it.
        const existing = await queryRunner.query(`
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'sections' AND con.contype = 'u'
        `);
        for (const row of existing) {
            await queryRunner.query(`ALTER TABLE "sections" DROP CONSTRAINT "${row.conname}"`);
        }

        const indexExists = await queryRunner.query(`
            SELECT 1 FROM pg_indexes
            WHERE indexname = 'IDX_sections_level_term_name_dept' AND tablename = 'sections'
        `);
        if (indexExists.length === 0) {
            // department_id is nullable; NULL is never equal to NULL for UNIQUE purposes in
            // Postgres, so two sections with the same level/term/name but both NULL
            // department_id won't collide here — same precedent as courses.
            await queryRunner.query(`
                CREATE UNIQUE INDEX "IDX_sections_level_term_name_dept"
                ON "sections" (level, term, name, department_id)
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sections_level_term_name_dept"`);
        await queryRunner.query(`
            ALTER TABLE "sections" ADD CONSTRAINT "sections_level_term_name_key" UNIQUE (level, term, name)
        `);
    }
}
