import { MigrationInterface, QueryRunner } from "typeorm";

export class DropStaleSectionUniqueIndex1782486000000 implements MigrationInterface {
    name = 'DropStaleSectionUniqueIndex1782486000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // TypeORM's original @Index(['level','term','name'], { unique: true }) decorator
        // created a plain UNIQUE INDEX (auto-named, not a table constraint), so the
        // ScopeSectionUniqueByDepartment migration's `pg_constraint` lookup never found
        // it and it was left in place — silently still blocking any section whose
        // (level, term, name) matched an existing one in a *different* department.
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_44b9f50a7e68ddff0ced49d0a5"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_44b9f50a7e68ddff0ced49d0a5" ON "sections" (level, term, name)
        `);
    }
}
