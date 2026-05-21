import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CTScheduleService } from './ct-schedule.service';
import { CTScheduleController } from './ct-schedule.controller';
import { CTSetting } from '../../entities/ct-setting.entity';
import { CTWeekConfig } from '../../entities/ct-week-config.entity';
import { CTAssignment } from '../../entities/ct-assignment.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { Room } from '../../entities/room.entity';
import { Course } from '../../entities/course.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CTSetting,
      CTWeekConfig,
      CTAssignment,
      CourseSectionTeacher,
      Room,
      Course,
    ]),
  ],
  controllers: [CTScheduleController],
  providers: [CTScheduleService],
  exports: [CTScheduleService],
})
export class CTScheduleModule {}
