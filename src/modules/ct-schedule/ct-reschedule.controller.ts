import { Controller, Get, Param, Post } from '@nestjs/common';
import { CTRescheduleService } from './ct-reschedule.service';

/** Reschedule CT — re-plans every CSE level-term class test that sits in week 10
 *  or later into weeks 11–14, in two groups that alternate their sitting days.
 *  Backed by a snapshot, so the plan can be regenerated any number of times and
 *  the original schedule restored in one click. */
@Controller('ct-schedule/reschedule')
export class CTRescheduleController {
  constructor(private readonly ctRescheduleService: CTRescheduleService) {}

  /** The layout Apply would write, plus anything it could not place. */
  @Get(':semesterId')
  getPlan(@Param('semesterId') semesterId: string) {
    return this.ctRescheduleService.getPlan(semesterId);
  }

  @Post('apply/:semesterId')
  apply(@Param('semesterId') semesterId: string) {
    return this.ctRescheduleService.apply(semesterId);
  }

  @Post('restore/:semesterId')
  restore(@Param('semesterId') semesterId: string) {
    return this.ctRescheduleService.restore(semesterId);
  }
}
