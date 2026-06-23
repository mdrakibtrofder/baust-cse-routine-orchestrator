import { Injectable } from '@nestjs/common';
import { AppSettingsService } from '../app-settings/app-settings.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  async getStatus() {
    return this.appSettingsService.get();
  }

  async enterMaintenance(operation: string, message: string) {
    const current = await this.appSettingsService.get();
    current.maintenance_mode = true;
    current.maintenance_operation = operation;
    current.maintenance_message = message;
    current.maintenance_started_at = new Date();
    return this.appSettingsService.save(current);
  }

  async exitMaintenance() {
    const current = await this.appSettingsService.get();
    current.maintenance_mode = false;
    current.maintenance_operation = null;
    current.maintenance_message = null;
    current.maintenance_started_at = null;
    return this.appSettingsService.save(current);
  }
}
