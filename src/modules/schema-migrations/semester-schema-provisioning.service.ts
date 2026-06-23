import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { PROVISIONING_DATA_TABLES, PUBLIC_ONLY_TABLES } from './schema-migrations.constants';

interface ProvisionSchemaInput {
  targetSchema: string;
  sourceSchema: string;
  onProgress?: (message: string) => Promise<void> | void;
}

@Injectable()
export class SemesterSchemaProvisioningService {
  constructor(private readonly dataSource: DataSource) {}

  async schemaExists(schemaName: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1 LIMIT 1`,
      [schemaName],
    );
    return rows.length > 0;
  }

  async provisionSchema(input: ProvisionSchemaInput): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();

    try {
      await runner.startTransaction();
      await input.onProgress?.(`Resetting target schema "${input.targetSchema}"`);
      await runner.query(`DROP SCHEMA IF EXISTS ${this.quoteIdentifier(input.targetSchema)} CASCADE`);
      await runner.query(`CREATE SCHEMA ${this.quoteIdentifier(input.targetSchema)}`);

      const tables = await this.getCloneableTables(runner);
      await input.onProgress?.(`Cloning ${tables.length} tables into schema "${input.targetSchema}"`);
      for (const table of tables) {
        await runner.query(
          `CREATE TABLE ${this.qualify(input.targetSchema, table)} (LIKE ${this.qualify('public', table)} INCLUDING ALL)`,
        );
      }

      const foreignKeys = await this.getForeignKeys(runner, tables);
      await input.onProgress?.(`Rebuilding ${foreignKeys.length} foreign keys in schema "${input.targetSchema}"`);
      for (const fk of foreignKeys) {
        const definition = this.rewriteConstraintDefinition(fk.constraint_def, input.targetSchema);
        await runner.query(
          `ALTER TABLE ${this.qualify(input.targetSchema, fk.table_name)} ADD CONSTRAINT ${this.quoteIdentifier(fk.constraint_name)} ${definition}`,
        );
      }

      await input.onProgress?.(`Copying template data from "${input.sourceSchema}"`);
      for (const table of PROVISIONING_DATA_TABLES) {
        if (!tables.includes(table)) continue;
        await runner.query(
          `INSERT INTO ${this.qualify(input.targetSchema, table)} SELECT * FROM ${this.qualify(input.sourceSchema, table)}`,
        );
      }

      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async getCloneableTables(runner: QueryRunner): Promise<string[]> {
    const rows = await runner.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name <> ALL($1::text[])
        ORDER BY table_name
      `,
      [PUBLIC_ONLY_TABLES],
    );
    return rows.map((row: { table_name: string }) => row.table_name);
  }

  private async getForeignKeys(
    runner: QueryRunner,
    tables: string[],
  ): Promise<Array<{ table_name: string; constraint_name: string; constraint_def: string }>> {
    const rows = await runner.query(
      `
        SELECT
          rel.relname AS table_name,
          con.conname AS constraint_name,
          pg_get_constraintdef(con.oid) AS constraint_def
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND con.contype = 'f'
          AND rel.relname = ANY($1::text[])
        ORDER BY rel.relname, con.conname
      `,
      [tables],
    );
    return rows;
  }

  private rewriteConstraintDefinition(definition: string, targetSchema: string): string {
    return definition.replace(
      /REFERENCES\s+(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/g,
      (_match, quotedTable, bareTable) => {
        const tableName = quotedTable ?? bareTable;
        const schemaName = (PUBLIC_ONLY_TABLES as readonly string[]).includes(tableName) ? 'public' : targetSchema;
        return `REFERENCES ${this.qualify(schemaName, tableName)}`;
      },
    );
  }

  private quoteIdentifier(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private qualify(schemaName: string, tableName: string): string {
    return `${this.quoteIdentifier(schemaName)}.${this.quoteIdentifier(tableName)}`;
  }
}
