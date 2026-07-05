import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseTypeToPriorityClasses1784100000000 implements MigrationInterface {
  name = 'AddCourseTypeToPriorityClasses1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "priority_classes"
      ADD COLUMN IF NOT EXISTS "course_type" varchar(20) NOT NULL DEFAULT 'Theory'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "priority_classes" DROP COLUMN IF EXISTS "course_type"`);
  }
}
