import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameTeacherAssignedCreditHours1777823200000 implements MigrationInterface {
  name = 'RenameTeacherAssignedCreditHours1777823200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'teachers'
            AND column_name = 'assigned_credit'
        ) THEN
          ALTER TABLE "teachers"
          RENAME COLUMN "assigned_credit" TO "assigned_credit_hours";
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'teachers'
            AND column_name = 'assigned_credit_hours'
        ) THEN
          ALTER TABLE "teachers"
          RENAME COLUMN "assigned_credit_hours" TO "assigned_credit";
        END IF;
      END
      $$;
    `);
  }
}
