import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassSlot } from '../../entities/class-slot.entity';
import { Teacher } from '../../entities/teacher.entity';
import { Room } from '../../entities/room.entity';
import { Section } from '../../entities/section.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { RoutineService } from './routine.service';
import { RoutineController } from './routine.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassSlot,
      Teacher,
      Room,
      Section,
      CourseSectionTeacher
    ])
  ],
  controllers: [RoutineController],
  providers: [RoutineService],
  exports: [RoutineService],
})
export class RoutineModule {}
