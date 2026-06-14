import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convert all TIMESTAMP (no timezone) columns to TIMESTAMPTZ so that TypeORM
 * reads back dates in UTC regardless of the host machine's local timezone.
 * Existing values are treated as UTC (which is what Supabase/PgBouncer stores).
 */
export class ConvertTimestampsToTimestamptz1779500000000 implements MigrationInterface {
  name = 'ConvertTimestampsToTimestamptz1779500000000';

  private readonly tables: string[] = [
    'semesters',
    'teachers',
    'rooms',
    'sections',
    'courses',
    'periods',
    'days',
    'course_section_teachers',
    'class_slots',
    'teacher_unavailabilities',
    'room_unavailabilities',
    'ct_settings',
    'ct_week_configs',
    'ct_assignments',
    'years',
    'semester_types',
    'users',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      const exists = await queryRunner.hasTable(table);
      if (!exists) continue;

      const hasCreatedAt = await queryRunner.hasColumn(table, 'created_at');
      const hasUpdatedAt = await queryRunner.hasColumn(table, 'updated_at');

      if (hasCreatedAt) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC'`,
        );
      }
      if (hasUpdatedAt) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING "updated_at" AT TIME ZONE 'UTC'`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      const exists = await queryRunner.hasTable(table);
      if (!exists) continue;

      const hasCreatedAt = await queryRunner.hasColumn(table, 'created_at');
      const hasUpdatedAt = await queryRunner.hasColumn(table, 'updated_at');

      if (hasCreatedAt) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC'`,
        );
      }
      if (hasUpdatedAt) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "updated_at" TYPE TIMESTAMP USING "updated_at" AT TIME ZONE 'UTC'`,
        );
      }
    }
  }
}
