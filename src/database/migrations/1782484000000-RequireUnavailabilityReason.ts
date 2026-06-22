import { MigrationInterface, QueryRunner } from "typeorm";

export class RequireUnavailabilityReason1782484000000 implements MigrationInterface {
    name = 'RequireUnavailabilityReason1782484000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // teacher_unavailability and room_unavailability were originally created via
        // TypeORM synchronize (no prior migration tracks them), so existing rows may
        // have a NULL reason. Backfill before enforcing NOT NULL.
        const teacherTableExists = await queryRunner.query(`
            SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_unavailability'
        `);
        if (teacherTableExists.length > 0) {
            await queryRunner.query(`
                UPDATE "teacher_unavailability" SET "reason" = 'Unspecified' WHERE "reason" IS NULL OR "reason" = ''
            `);
            await queryRunner.query(`
                ALTER TABLE "teacher_unavailability" ALTER COLUMN "reason" SET NOT NULL
            `);
        }

        const roomTableExists = await queryRunner.query(`
            SELECT 1 FROM information_schema.tables WHERE table_name = 'room_unavailability'
        `);
        if (roomTableExists.length > 0) {
            await queryRunner.query(`
                UPDATE "room_unavailability" SET "reason" = 'Unspecified' WHERE "reason" IS NULL OR "reason" = ''
            `);
            await queryRunner.query(`
                ALTER TABLE "room_unavailability" ALTER COLUMN "reason" SET NOT NULL
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "teacher_unavailability" ALTER COLUMN "reason" DROP NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "room_unavailability" ALTER COLUMN "reason" DROP NOT NULL
        `);
    }
}
