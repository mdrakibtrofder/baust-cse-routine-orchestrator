import { Controller, Get, Patch, Body } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { UpdateAppSettingDto } from '../../dtos/app-setting.dto';

@Controller('settings')
export class AppSettingsController {
  constructor(private readonly service: AppSettingsService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  update(@Body() dto: UpdateAppSettingDto) {
    return this.service.update(dto);
  }
}
