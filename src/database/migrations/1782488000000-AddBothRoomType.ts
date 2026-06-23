import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBothRoomType1782488000000 implements MigrationInterface {
  name = 'AddBothRoomType1782488000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The original InitialSchema migration defined room_type with an inline
    // `CHECK (room_type IN ('Theory', 'Sessional'))`. Drop whatever check constraint
    // currently covers this column (name may vary) and add one that also allows 'Both'
    // — a room usable for either theory or sessional classes.
    const existing = await queryRunner.query(`
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'rooms' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%room_type%'
    `);
    for (const row of existing) {
      await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "${row.conname}"`);
    }

    await queryRunner.query(`
      ALTER TABLE "rooms"
      ADD CONSTRAINT "rooms_room_type_check" CHECK (room_type IN ('Theory', 'Sessional', 'Both'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_room_type_check"`);
    // Reassign any 'Both' rooms to 'Theory' so the narrower constraint can be restored.
    await queryRunner.query(`UPDATE "rooms" SET "room_type" = 'Theory' WHERE "room_type" = 'Both'`);
    await queryRunner.query(`
      ALTER TABLE "rooms"
      ADD CONSTRAINT "rooms_room_type_check" CHECK (room_type IN ('Theory', 'Sessional'))
    `);
  }
}
