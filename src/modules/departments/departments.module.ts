import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../../entities/department.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Department, Course, Section, Room])],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
