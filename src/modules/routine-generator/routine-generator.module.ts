import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutineGeneratorService } from './routine-generator.service';
import { RoutineGeneratorController } from './routine-generator.controller';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { Period } from '../../entities/period.entity';
import { Day } from '../../entities/day.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { CourseLabSection } from '../../entities/course-lab-section.entity';
import { Department } from '../../entities/department.entity';
import { TeacherUnavailability } from '../../entities/teacher-unavailability.entity';
import { RoomUnavailability } from '../../entities/room-unavailability.entity';
import { PriorityClass } from '../../entities/priority-class.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassSlot,
      Course,
      Section,
      Room,
      Period,
      Day,
      CourseSectionTeacher,
      CourseLabSection,
      Department,
      TeacherUnavailability,
      RoomUnavailability,
      PriorityClass,
    ]),
  ],
  controllers: [RoutineGeneratorController],
  providers: [RoutineGeneratorService],
  exports: [RoutineGeneratorService],
})
export class RoutineGeneratorModule {}
