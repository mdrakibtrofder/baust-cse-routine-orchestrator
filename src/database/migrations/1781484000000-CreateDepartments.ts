import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDepartments1781484000000 implements MigrationInterface {
    name = 'CreateDepartments1781484000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "departments" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "short_name" varchar(20) NOT NULL UNIQUE,
                "full_name" varchar(200) NOT NULL,
                "faculty_name" varchar(200) NOT NULL,
                "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "departments"`);
    }
}
