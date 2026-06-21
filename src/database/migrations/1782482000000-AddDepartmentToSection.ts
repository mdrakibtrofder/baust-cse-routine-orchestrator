import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepartmentToSection1782482000000 implements MigrationInterface {
    name = 'AddDepartmentToSection1782482000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sections" 
            ADD COLUMN IF NOT EXISTS "departmental_type" varchar(20) NOT NULL DEFAULT 'Departmental'
        `);
        await queryRunner.query(`
            ALTER TABLE "sections" 
            ADD CONSTRAINT "sections_departmental_type_check" 
            CHECK (departmental_type IN ('Departmental', 'Non-Departmental'))
        `);
        await queryRunner.query(`
            ALTER TABLE "sections" 
            ADD COLUMN IF NOT EXISTS "department_id" uuid
        `);
        await queryRunner.query(`
            ALTER TABLE "sections" 
            ADD CONSTRAINT "FK_sections_department_id" 
            FOREIGN KEY ("department_id") 
            REFERENCES "departments"("id") 
            ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sections" 
            DROP CONSTRAINT "FK_sections_department_id"
        `);
        await queryRunner.query(`
            ALTER TABLE "sections" 
            DROP CONSTRAINT "sections_departmental_type_check"
        `);
        await queryRunner.query(`
            ALTER TABLE "sections" 
            DROP COLUMN "departmental_type"
        `);
        await queryRunner.query(`
            ALTER TABLE "sections" 
            DROP COLUMN "department_id"
        `);
    }
}
