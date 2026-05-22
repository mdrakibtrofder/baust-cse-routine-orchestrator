import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStartWeekToCTSettings1779417428000 implements MigrationInterface {
    name = 'AddStartWeekToCTSettings1779417428000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ct_settings" ADD "start_week" integer NOT NULL DEFAULT 4`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ct_settings" DROP COLUMN "start_week"`);
    }
}
