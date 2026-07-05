import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLockedToClassSlot1783230800001 implements MigrationInterface {
  name = 'AddLockedToClassSlot1783230800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "class_slots"
      ADD COLUMN IF NOT EXISTS "locked" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "class_slots" DROP COLUMN IF EXISTS "locked"`);
  }
}
