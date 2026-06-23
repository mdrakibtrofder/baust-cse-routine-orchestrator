import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBreakPeriodAndAppSettings1782489000000 implements MigrationInterface {
  name = 'AddBreakPeriodAndAppSettings1782489000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "periods"
      ADD COLUMN IF NOT EXISTS "is_break" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "show_break_column" boolean NOT NULL DEFAULT true,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_settings" PRIMARY KEY ("id")
      )
    `);

    // Seed the single settings row so GET /settings never has to lazily create one
    // under concurrent first-load requests.
    const existing = await queryRunner.query(`SELECT 1 FROM "app_settings" LIMIT 1`);
    if (existing.length === 0) {
      await queryRunner.query(`INSERT INTO "app_settings" ("show_break_column") VALUES (true)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_settings"`);
    await queryRunner.query(`ALTER TABLE "periods" DROP COLUMN IF EXISTS "is_break"`);
  }
}
