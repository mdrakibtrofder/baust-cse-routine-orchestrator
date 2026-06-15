import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseLabGroup } from '../../entities/course-lab-group.entity';
import { ClassSlot } from '../../entities/class-slot.entity';
import { LabGroupsService } from './lab-groups.service';
import { LabGroupsController } from './lab-groups.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CourseLabGroup, ClassSlot])],
  providers: [LabGroupsService],
  controllers: [LabGroupsController],
  exports: [LabGroupsService],
})
export class LabGroupsModule {}
