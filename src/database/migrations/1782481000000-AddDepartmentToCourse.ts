import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepartmentToCourse1782481000000 implements MigrationInterface {
    name = 'AddDepartmentToCourse1782481000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "courses" 
            ADD COLUMN IF NOT EXISTS "departmental_type" varchar(20) NOT NULL DEFAULT 'Departmental'
        `);

        // Check if check constraint exists
        const checkConstraintExists = await queryRunner.query(`
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'courses_departmental_type_check' AND conrelid = 'courses'::regclass
        `);
        if (checkConstraintExists.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "courses" 
                ADD CONSTRAINT "courses_departmental_type_check" 
                CHECK (departmental_type IN ('Departmental', 'Non-Departmental'))
            `);
        }

        await queryRunner.query(`
            ALTER TABLE "courses" 
            ADD COLUMN IF NOT EXISTS "department_id" uuid
        `);

        // Check if fk constraint exists
        const fkConstraintExists = await queryRunner.query(`
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'FK_courses_department_id' AND conrelid = 'courses'::regclass
        `);
        if (fkConstraintExists.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "courses" 
                ADD CONSTRAINT "FK_courses_department_id" 
                FOREIGN KEY ("department_id") 
                REFERENCES "departments"("id") 
                ON DELETE SET NULL
            `);
        }

        // Check & handle unique index
        const oldConstraintExists = await queryRunner.query(`
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'IDX_courses_code_level_term_dept' AND conrelid = 'courses'::regclass
        `);
        if (oldConstraintExists.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "courses" 
                DROP CONSTRAINT "IDX_courses_code_level_term_dept"
            `);
        }

        const indexExists = await queryRunner.query(`
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'IDX_courses_code_level_term_dept' AND tablename = 'courses'
        `);
        if (indexExists.length === 0) {
            await queryRunner.query(`
                CREATE UNIQUE INDEX "IDX_courses_code_level_term_dept" 
                ON "courses" (code, level, term, departmental_type)
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_courses_code_level_term_dept"
        `);
        await queryRunner.query(`
            ALTER TABLE "courses" 
            DROP CONSTRAINT IF EXISTS "FK_courses_department_id"
        `);
        await queryRunner.query(`
            ALTER TABLE "courses" 
            DROP CONSTRAINT IF EXISTS "courses_departmental_type_check"
        `);
        await queryRunner.query(`
            ALTER TABLE "courses" 
            DROP COLUMN IF EXISTS "departmental_type"
        `);
        await queryRunner.query(`
            ALTER TABLE "courses" 
            DROP COLUMN IF EXISTS "department_id"
        `);
    }
}
