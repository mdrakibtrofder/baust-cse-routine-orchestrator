import { Logger, QueryRunner } from 'typeorm';
import { Logger as NestLogger } from '@nestjs/common';

export class CustomTypeORMLogger implements Logger {
  private readonly nestLogger = new NestLogger('TypeORM');

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    try {
      const sql = query.trim().toLowerCase();
      // Only log data-modifying queries
      if (sql.startsWith('insert') || sql.startsWith('update') || sql.startsWith('delete')) {
        let paramsStr = '';
        if (parameters && parameters.length > 0) {
          try {
            paramsStr = ` -- Parameters: ${JSON.stringify(parameters, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`;
          } catch (e) {
            paramsStr = ' -- Parameters: [Serialization Failed]';
          }
        }
        this.nestLogger.log(`Query: ${query}${paramsStr}`);
      }
    } catch (e) {
      // Ensure logger never crashes the application
    }
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    try {
      let paramsStr = '';
      if (parameters && parameters.length > 0) {
        try {
          paramsStr = ` -- Parameters: ${JSON.stringify(parameters, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`;
        } catch (e) {
          paramsStr = ' -- Parameters: [Serialization Failed]';
        }
      }
      this.nestLogger.error(`Query Error: ${error} -- Query: ${query}${paramsStr}`);
    } catch (e) {}
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    try {
      let paramsStr = '';
      if (parameters && parameters.length > 0) {
        try {
          paramsStr = ` -- Parameters: ${JSON.stringify(parameters, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`;
        } catch (e) {
          paramsStr = ' -- Parameters: [Serialization Failed]';
        }
      }
      this.nestLogger.warn(`Slow Query (${time}ms): ${query}${paramsStr}`);
    } catch (e) {}
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
