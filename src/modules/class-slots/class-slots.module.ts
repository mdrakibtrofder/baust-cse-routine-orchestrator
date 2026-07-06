import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Course } from '../../entities/course.entity';
import { Section } from '../../entities/section.entity';
import { Room } from '../../entities/room.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { TeacherUnavailability } from '../../entities/teacher-unavailability.entity';
import { RoomUnavailability } from '../../entities/room-unavailability.entity';
import { CourseLabSection } from '../../entities/course-lab-section.entity';
import { ClassSlotsService } from './class-slots.service';
import { ClassSlotsController } from './class-slots.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassSlot,
      Course,
      Section,
      Room,
      CourseSectionTeacher,
      TeacherUnavailability,
      RoomUnavailability,
      CourseLabSection,
    ])
  ],
  controllers: [ClassSlotsController],
  providers: [ClassSlotsService],
  exports: [ClassSlotsService],
})
export class ClassSlotsModule {}
