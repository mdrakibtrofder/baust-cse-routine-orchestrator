import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SchemaMigrationLogService } from './schema-migration-log.service';

@Injectable()
export class SchemaMigrationCleanupService {
  private readonly logger = new Logger(SchemaMigrationCleanupService.name);

  constructor(private readonly logService: SchemaMigrationLogService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    try {
      const deleted = await this.logService.deleteOlderThan(cutoff);
      await this.logService.write({
        operation: 'LOG_RETENTION_CLEANUP',
        status: 'COMPLETED',
        message: `Deleted ${deleted} schema migration log rows older than ${cutoff.toISOString()}.`,
      });
    } catch (error: any) {
      const errorMessage = error?.message ?? 'Unknown log retention cleanup failure';
      this.logger.error(errorMessage, error?.stack);
      await this.logService.write({
        operation: 'LOG_RETENTION_CLEANUP',
        status: 'FAILED',
        level: 'ERROR',
        message: 'Schema migration log cleanup job failed.',
        errorDetails: error?.stack ?? String(error),
      });
    }
  }
}
