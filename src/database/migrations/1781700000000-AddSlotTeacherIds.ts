import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlotTeacherIds1781700000000 implements MigrationInterface {
  name = 'AddSlotTeacherIds1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_section_teachers"
        ADD COLUMN IF NOT EXISTS "slot_teacher_ids" jsonb DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_section_teachers"
        DROP COLUMN IF EXISTS "slot_teacher_ids"
    `);
  }
}
