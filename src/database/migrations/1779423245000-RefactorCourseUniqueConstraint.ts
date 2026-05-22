import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorCourseUniqueConstraint1779423245000 implements MigrationInterface {
    name = 'RefactorCourseUniqueConstraint1779423245000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop the Existing Constraint/Index
        // The user specified IDX_be4d9f6466a78920b31de15fc0 which matches @Index(['code', 'level', 'term'], { unique: true })
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_be4d9f6466a78920b31de15fc0"`);

        // 2. Run the UPDATE Query for Non-Departmental courses
        await queryRunner.query(`
            UPDATE public.courses 
            SET 
                level = SUBSTRING(code FROM '[0-9]')::integer, 
                term = CASE SUBSTRING(code FROM '[0-9]([0-9])') 
                            WHEN '1' THEN 'I' 
                            WHEN '2' THEN 'II' 
                            ELSE term 
                        END 
            WHERE departmental_type = 'Non-Departmental'
        `);

        // 3. Create the New, Multi-Column Unique Constraint
        await queryRunner.query(`
            ALTER TABLE public.courses 
            ADD CONSTRAINT "IDX_courses_code_level_term_dept" 
            UNIQUE (code, level, term, departmental_type)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback: Remove new constraint
        await queryRunner.query(`ALTER TABLE public.courses DROP CONSTRAINT "IDX_courses_code_level_term_dept"`);
        
        // Recreate the old index (Note: this might fail if duplicate data was introduced during UP)
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_be4d9f6466a78920b31de15fc0" ON "courses" ("code", "level", "term")`);
    }
}
