import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepartmentColumnsToEntities1781500000000 implements MigrationInterface {
    name = 'AddDepartmentColumnsToEntities1781500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // rooms
        await queryRunner.query(`
            ALTER TABLE "rooms"
                ADD COLUMN IF NOT EXISTS "departmental_type" varchar(20) NOT NULL DEFAULT 'Departmental',
                ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL
        `);

        // sections
        await queryRunner.query(`
            ALTER TABLE "sections"
                ADD COLUMN IF NOT EXISTS "departmental_type" varchar(20) NOT NULL DEFAULT 'Departmental',
                ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL
        `);

        // courses — departmental_type already exists, only add department_id
        await queryRunner.query(`
            ALTER TABLE "courses"
                ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN IF EXISTS "department_id"`);
        await queryRunner.query(`ALTER TABLE "sections" DROP COLUMN IF EXISTS "department_id", DROP COLUMN IF EXISTS "departmental_type"`);
        await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN IF EXISTS "department_id", DROP COLUMN IF EXISTS "departmental_type"`);
    }
}
