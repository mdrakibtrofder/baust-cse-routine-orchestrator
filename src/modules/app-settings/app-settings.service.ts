import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from '../../entities/app-setting.entity';
import { UpdateAppSettingDto } from '../../dtos/app-setting.dto';

@Injectable()
export class AppSettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
  ) {}

  /** Single-row settings table — create the row on first access if it doesn't exist yet. */
  async get(): Promise<AppSetting> {
    const existing = await this.repo.find({ take: 1 });
    if (existing.length > 0) return existing[0];
    const created = this.repo.create({ show_break_column: true });
    return this.repo.save(created);
  }

  async update(dto: UpdateAppSettingDto): Promise<AppSetting> {
    const current = await this.get();
    Object.assign(current, dto);
    return this.repo.save(current);
  }

  async save(entity: AppSetting): Promise<AppSetting> {
    return this.repo.save(entity);
  }
}
