import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Semester } from '../../entities/semester.entity';
import { SchemaMigrationLog } from '../../entities/schema-migration-log.entity';
import { MaintenanceService } from './maintenance.service';
import { SchemaMigrationLogService } from './schema-migration-log.service';
import { SemesterSchemaProvisioningService } from './semester-schema-provisioning.service';
import { SCHEMA_MIGRATIONS_QUEUE } from './schema-migrations.constants';

export interface SchemaMigrationJobData {
  semesterId: string;
}

@Injectable()
export class SchemaMigrationsService {
  private readonly logger = new Logger(SchemaMigrationsService.name);

  constructor(
    @InjectRepository(Semester)
    private readonly semesterRepository: Repository<Semester>,
    @InjectQueue(SCHEMA_MIGRATIONS_QUEUE)
    private readonly queue: Queue<SchemaMigrationJobData>,
    private readonly maintenanceService: MaintenanceService,
    private readonly logService: SchemaMigrationLogService,
    private readonly provisioningService: SemesterSchemaProvisioningService,
  ) {}

  async enqueueProvisioning(semesterId: string) {
    const semester = await this.semesterRepository.findOne({ where: { id: semesterId } });
    if (!semester) throw new NotFoundException(`Semester with ID ${semesterId} not found`);

    const schemaName = semester.schema_name ?? this.buildSchemaName(semester.name);
    await this.semesterRepository.update(semesterId, {
      schema_name: schemaName,
      schema_status: 'PENDING',
      schema_error: null,
    });

    await this.queue.add(
      'provision',
      { semesterId },
      {
        jobId: `semester-schema-${semesterId}`,
        removeOnComplete: 25,
        removeOnFail: 50,
      },
    );

    await this.logService.write({
      semesterId,
      schemaName,
      operation: 'QUEUE_ENQUEUE',
      status: 'QUEUED',
      message: `Queued schema provisioning for semester ${semester.name}.`,
    });

    return { success: true, schema_name: schemaName, status: 'QUEUED' };
  }

  async retryProvisioning(semesterId: string) {
    await this.queue.remove(`semester-schema-${semesterId}`).catch(() => undefined);
    return this.enqueueProvisioning(semesterId);
  }

  async getRecentLogs(limit = 100): Promise<SchemaMigrationLog[]> {
    return this.logService.recent(limit);
  }

  async processProvisioningJob(data: SchemaMigrationJobData) {
    const semester = await this.semesterRepository.findOne({ where: { id: data.semesterId } });
    if (!semester) throw new NotFoundException(`Semester with ID ${data.semesterId} not found`);

    const schemaName = semester.schema_name ?? this.buildSchemaName(semester.name);
    const sourceSchema = await this.resolveSourceSchema(semester);
    const startedAt = Date.now();

    await this.semesterRepository.update(semester.id, {
      schema_name: schemaName,
      schema_status: 'PROVISIONING',
      schema_source_name: sourceSchema,
      schema_error: null,
    });

    await this.maintenanceService.enterMaintenance(
      'SEMESTER_SCHEMA_PROVISIONING',
      `System maintenance in progress while provisioning schema ${schemaName}. Write operations are temporarily disabled.`,
    );

    await this.logService.write({
      semesterId: semester.id,
      schemaName,
      operation: 'SCHEMA_PROVISION',
      status: 'STARTED',
      message: `Started provisioning schema ${schemaName} from source ${sourceSchema}.`,
    });

    try {
      await this.provisioningService.provisionSchema({
        targetSchema: schemaName,
        sourceSchema,
        onProgress: async (message) => {
          await this.logService.write({
            semesterId: semester.id,
            schemaName,
            operation: 'SCHEMA_PROVISION',
            status: 'RUNNING',
            message,
          });
        },
      });

      await this.semesterRepository.update(semester.id, {
        schema_name: schemaName,
        schema_status: 'READY',
        schema_source_name: sourceSchema,
        schema_last_synced_at: new Date(),
        schema_error: null,
      });

      await this.logService.write({
        semesterId: semester.id,
        schemaName,
        operation: 'SCHEMA_PROVISION',
        status: 'COMPLETED',
        message: `Schema ${schemaName} provisioned successfully.`,
        durationMs: Date.now() - startedAt,
      });
    } catch (error: any) {
      const errorMessage = error?.message ?? 'Unknown schema provisioning failure';
      await this.semesterRepository.update(semester.id, {
        schema_name: schemaName,
        schema_status: 'FAILED',
        schema_source_name: sourceSchema,
        schema_error: errorMessage,
      });

      await this.logService.write({
        semesterId: semester.id,
        schemaName,
        operation: 'SCHEMA_PROVISION',
        status: 'FAILED',
        level: 'ERROR',
        message: `Schema provisioning failed for ${schemaName}.`,
        errorDetails: error?.stack ?? String(error),
        durationMs: Date.now() - startedAt,
      });

      this.logger.error(`Schema provisioning failed for ${schemaName}`, error?.stack ?? errorMessage);
      throw error;
    } finally {
      await this.maintenanceService.exitMaintenance();
    }
  }

  buildSchemaName(semesterName: string): string {
    const normalized = semesterName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return normalized.match(/^[a-z_]/) ? normalized : `semester_${normalized || 'default'}`;
  }

  private async resolveSourceSchema(semester: Semester): Promise<string> {
    if (semester.schema_source_name && await this.provisioningService.schemaExists(semester.schema_source_name)) {
      return semester.schema_source_name;
    }

    const source = await this.semesterRepository.findOne({
      where: {
        is_active: true,
      },
      order: { updated_at: 'DESC' },
    });

    if (
      source &&
      source.id !== semester.id &&
      source.schema_name &&
      source.schema_status === 'READY' &&
      await this.provisioningService.schemaExists(source.schema_name)
    ) {
      return source.schema_name;
    }

    return 'public';
  }
}
