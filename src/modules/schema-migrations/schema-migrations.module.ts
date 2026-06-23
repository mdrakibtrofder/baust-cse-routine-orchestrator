import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from '../../entities/app-setting.entity';
import { SchemaMigrationLog } from '../../entities/schema-migration-log.entity';
import { Semester } from '../../entities/semester.entity';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { SCHEMA_MIGRATIONS_QUEUE } from './schema-migrations.constants';
import { MaintenanceService } from './maintenance.service';
import { SchemaMigrationCleanupService } from './schema-migration-cleanup.service';
import { SchemaMigrationLogService } from './schema-migration-log.service';
import { SchemaMigrationsController } from './schema-migrations.controller';
import { SchemaMigrationsProcessor } from './schema-migrations.processor';
import { SchemaMigrationsService } from './schema-migrations.service';
import { SemesterSchemaProvisioningService } from './semester-schema-provisioning.service';

@Module({
  imports: [
    AppSettingsModule,
    BullModule.registerQueue({
      name: SCHEMA_MIGRATIONS_QUEUE,
    }),
    TypeOrmModule.forFeature([Semester, SchemaMigrationLog, AppSetting]),
  ],
  controllers: [SchemaMigrationsController],
  providers: [
    MaintenanceService,
    SchemaMigrationCleanupService,
    SchemaMigrationLogService,
    SchemaMigrationsProcessor,
    SchemaMigrationsService,
    SemesterSchemaProvisioningService,
  ],
  exports: [MaintenanceService, SchemaMigrationLogService, SchemaMigrationsService],
})
export class SchemaMigrationsModule {}
