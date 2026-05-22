import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepartmentalTypeToCourses1779421260000 implements MigrationInterface {
    name = 'AddDepartmentalTypeToCourses1779421260000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" ADD "departmental_type" character varying(20) NOT NULL DEFAULT 'Departmental'`);
        // TypeORM will automatically backfill existing records with 'Departmental' due to the NOT NULL DEFAULT constraint.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "departmental_type"`);
    }
}
