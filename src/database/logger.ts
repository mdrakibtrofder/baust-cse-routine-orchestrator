import { Logger, QueryRunner } from 'typeorm';
import { Logger as NestLogger } from '@nestjs/common';

export class CustomTypeORMLogger implements Logger {
  private readonly nestLogger = new NestLogger('TypeORM');

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    const sql = query.toLowerCase();
    // Only log data-modifying queries
    if (sql.startsWith('insert') || sql.startsWith('update') || sql.startsWith('delete')) {
      this.nestLogger.log(`Query: ${query}${parameters?.length ? ` -- Parameters: ${JSON.stringify(parameters)}` : ''}`);
    }
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    this.nestLogger.error(`Query Error: ${error} -- Query: ${query}${parameters?.length ? ` -- Parameters: ${JSON.stringify(parameters)}` : ''}`);
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    this.nestLogger.warn(`Slow Query (${time}ms): ${query}${parameters?.length ? ` -- Parameters: ${JSON.stringify(parameters)}` : ''}`);
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    // Keep these as they are infrequent and important
    this.nestLogger.log(`Schema Build: ${message}`);
  }

  logMigration(message: string, queryRunner?: QueryRunner) {
    this.nestLogger.log(`Migration: ${message}`);
  }

  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
    // Suppress general logs unless they are warnings
    if (level === 'warn') {
      this.nestLogger.warn(message);
    }
  }
}
