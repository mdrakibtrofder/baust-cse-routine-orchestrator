import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessional3CourseType1781600000000 implements MigrationInterface {
  name = 'AddSessional3CourseType1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old CHECK constraint and add new one that includes sessional_3.0
    await queryRunner.query(`
      ALTER TABLE "courses"
        DROP CONSTRAINT IF EXISTS "courses_course_type_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "courses"
        ADD CONSTRAINT "courses_course_type_check"
        CHECK (course_type IN ('theory_2.0', 'theory_3.0', 'sessional_1.5', 'sessional_0.75', 'sessional_3.0'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
        DROP CONSTRAINT IF EXISTS "courses_course_type_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "courses"
        ADD CONSTRAINT "courses_course_type_check"
        CHECK (course_type IN ('theory_2.0', 'theory_3.0', 'sessional_1.5', 'sessional_0.75'))
    `);
  }
}
