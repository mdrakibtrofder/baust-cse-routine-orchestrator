import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SCHEMA_MIGRATIONS_QUEUE } from './schema-migrations.constants';
import { SchemaMigrationJobData, SchemaMigrationsService } from './schema-migrations.service';

@Processor(SCHEMA_MIGRATIONS_QUEUE)
export class SchemaMigrationsProcessor extends WorkerHost {
  constructor(private readonly schemaMigrationsService: SchemaMigrationsService) {
    super();
  }

  async process(job: Job<SchemaMigrationJobData>): Promise<void> {
    await this.schemaMigrationsService.processProvisioningJob(job.data);
  }
}
