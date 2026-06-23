import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchemaMigrationsAndRoutineGenerationTables1782490000000 implements MigrationInterface {
  name = 'AddSchemaMigrationsAndRoutineGenerationTables1782490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create schema_migration_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schema_migration_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "semester_id" uuid,
        "schema_name" varchar(150),
        "operation" varchar(50) NOT NULL,
        "status" varchar(20) NOT NULL,
        "level" varchar(20) NOT NULL DEFAULT 'INFO',
        "message" text NOT NULL,
        "error_details" text,
        "duration_ms" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_schema_migration_logs" PRIMARY KEY ("id")
      )
    `);

    // Create routine_generation_runs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "routine_generation_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "semester_id" uuid NOT NULL,
        "semester_name" varchar(200) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'RUNNING',
        "total_slots" integer NOT NULL DEFAULT 0,
        "generated_slots" integer NOT NULL DEFAULT 0,
        "failed_slots" integer NOT NULL DEFAULT 0,
        "success_rate" numeric(5, 2),
        "started_at" TIMESTAMPTZ,
        "ended_at" TIMESTAMPTZ,
        "error_message" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_routine_generation_runs" PRIMARY KEY ("id")
      )
    `);

    // Create routine_generation_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "routine_generation_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "run_id" uuid NOT NULL,
        "semester_id" uuid NOT NULL,
        "level" varchar(20) NOT NULL DEFAULT 'INFO',
        "message" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_routine_generation_logs" PRIMARY KEY ("id")
      )
    `);

    // Add indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_schema_migration_logs_semester_id"
      ON "schema_migration_logs" ("semester_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_schema_migration_logs_created_at"
      ON "schema_migration_logs" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_routine_generation_runs_semester_id"
      ON "routine_generation_runs" ("semester_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_routine_generation_runs_created_at"
      ON "routine_generation_runs" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_routine_generation_logs_run_id"
      ON "routine_generation_logs" ("run_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_routine_generation_logs_semester_id"
      ON "routine_generation_logs" ("semester_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_routine_generation_logs_semester_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_routine_generation_logs_run_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_routine_generation_runs_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_routine_generation_runs_semester_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schema_migration_logs_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schema_migration_logs_semester_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "routine_generation_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "routine_generation_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "schema_migration_logs"`);
  }
}
