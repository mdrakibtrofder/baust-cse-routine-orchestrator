import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { CTScheduleService } from './ct-schedule.service';
import {
  UpdateCTSettingDto,
  UpdateCTWeekConfigsDto,
  UpdateCTAssignmentDto,
  UpdateCTLevelTermDayMappingsDto,
  UpdateCTLevelTermRoomMappingsDto,
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
}

