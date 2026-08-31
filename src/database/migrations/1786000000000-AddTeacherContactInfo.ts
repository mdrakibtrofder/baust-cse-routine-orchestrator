import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds contact details to teachers.
 *
 *  Both default to an empty string rather than null: every existing teacher
 *  predates the columns, and a blank string keeps the API, the teacher table and
 *  the Excel export free of null handling. */
export class AddTeacherContactInfo1786000000000 implements MigrationInterface {
  name = 'AddTeacherContactInfo1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "email" character varying(150) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "phone" character varying(30) NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN IF EXISTS "phone"`);
    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN IF EXISTS "email"`);
  }
}
