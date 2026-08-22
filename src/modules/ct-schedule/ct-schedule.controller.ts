import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { CTScheduleService } from './ct-schedule.service';
import {
  UpdateCTSettingDto,
  UpdateCTWeekConfigsDto,
  UpdateCTAssignmentDto,
  UpdateCTLevelTermDayMappingsDto,
  UpdateCTLevelTermRoomMappingsDto,
  SwapCTDto,
} from '../../dtos/ct-schedule.dto';

@Controller('ct-schedule')
export class CTScheduleController {
  constructor(private readonly ctScheduleService: CTScheduleService) {}

  @Get('settings/:semesterId')
  getSettings(@Param('semesterId') semesterId: string) {
    return this.ctScheduleService.getSettings(semesterId);
  }

  @Put('settings/:semesterId')
  updateSettings(@Param('semesterId') semesterId: string, @Body() dto: UpdateCTSettingDto) {
    return this.ctScheduleService.updateSettings(semesterId, dto);
  }

  @Get('week-configs/:semesterId')
  getWeekConfigs(@Param('semesterId') semesterId: string) {
    return this.ctScheduleService.getWeekConfigs(semesterId);
  }

  @Put('week-configs/:semesterId')
  updateWeekConfigs(@Param('semesterId') semesterId: string, @Body() dto: UpdateCTWeekConfigsDto) {
    return this.ctScheduleService.updateWeekConfigs(semesterId, dto);
  }

  @Get('day-mappings/:semesterId')
  getDayMappings(@Param('semesterId') semesterId: string) {
    return this.ctScheduleService.getDayMappings(semesterId);
  }

  @Put('day-mappings/:semesterId')
  updateDayMappings(@Param('semesterId') semesterId: string, @Body() dto: UpdateCTLevelTermDayMappingsDto) {
    return this.ctScheduleService.updateDayMappings(semesterId, dto);
  }

  @Get('room-mappings/:semesterId')
  getRoomMappings(@Param('semesterId') semesterId: string) {
    return this.ctScheduleService.getRoomMappings(semesterId);
  }

  @Put('room-mappings/:semesterId')
  updateRoomMappings(@Param('semesterId') semesterId: string, @Body() dto: UpdateCTLevelTermRoomMappingsDto) {
    return this.ctScheduleService.updateRoomMappings(semesterId, dto);
  }

  @Get('assignments/:semesterId')
  getAssignments(@Param('semesterId') semesterId: string) {
    return this.ctScheduleService.getAssignments(semesterId);
  }

  @Post('generate/:semesterId')
  generateSchedule(@Param('semesterId') semesterId: string) {
    return this.ctScheduleService.generateSchedule(semesterId);
  }

  @Put('assignments/:id')
  updateAssignment(@Param('id') id: string, @Body() dto: UpdateCTAssignmentDto) {
    return this.ctScheduleService.updateAssignment(id, dto);
  }

  /** Dry run — reports the sittings a swap would exchange and any warnings it
   *  would raise, without writing anything. */
  @Post('swap-preview/:semesterId')
  previewSwap(@Param('semesterId') semesterId: string, @Body() dto: SwapCTDto) {
    return this.ctScheduleService.previewSwap(semesterId, dto);
  }

  /** Exchanges date, week and rooms between two courses' CTs — the whole series
   *  (`mode: 'all'`) or one matching CT number (`mode: 'single'`). */
  @Post('swap/:semesterId')
  swapCTs(@Param('semesterId') semesterId: string, @Body() dto: SwapCTDto) {
    return this.ctScheduleService.swapCTs(semesterId, dto);
  }

}

