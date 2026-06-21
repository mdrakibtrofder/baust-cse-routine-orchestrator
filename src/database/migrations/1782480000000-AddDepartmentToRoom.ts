import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepartmentToRoom1782480000000 implements MigrationInterface {
    name = 'AddDepartmentToRoom1782480000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "rooms" 
            ADD COLUMN IF NOT EXISTS "departmental_type" varchar(20) NOT NULL DEFAULT 'Departmental'
        `);

        // Check if check constraint exists
        const checkConstraintExists = await queryRunner.query(`
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'rooms_departmental_type_check' AND conrelid = 'rooms'::regclass
        `);
        if (checkConstraintExists.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "rooms" 
                ADD CONSTRAINT "rooms_departmental_type_check" 
                CHECK (departmental_type IN ('Departmental', 'Non-Departmental'))
            `);
        }

        await queryRunner.query(`
            ALTER TABLE "rooms" 
            ADD COLUMN IF NOT EXISTS "department_id" uuid
        `);

        // Check if fk constraint exists
        const fkConstraintExists = await queryRunner.query(`
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'FK_rooms_department_id' AND conrelid = 'rooms'::regclass
        `);
        if (fkConstraintExists.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "rooms" 
                ADD CONSTRAINT "FK_rooms_department_id" 
                FOREIGN KEY ("department_id") 
                REFERENCES "departments"("id") 
                ON DELETE SET NULL
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "rooms" 
            DROP CONSTRAINT IF EXISTS "FK_rooms_department_id"
        `);
        await queryRunner.query(`
            ALTER TABLE "rooms" 
            DROP CONSTRAINT IF EXISTS "rooms_departmental_type_check"
        `);
        await queryRunner.query(`
            ALTER TABLE "rooms" 
            DROP COLUMN IF EXISTS "departmental_type"
        `);
        await queryRunner.query(`
            ALTER TABLE "rooms" 
            DROP COLUMN IF EXISTS "department_id"
        `);
    }
}
