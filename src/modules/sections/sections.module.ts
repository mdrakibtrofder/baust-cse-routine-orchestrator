import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Section } from '../../entities/section.entity';
import { ClassSlot } from '../../entities/class-slot.entity';
import { CourseSectionTeacher } from '../../entities/course-section-teacher.entity';
import { CTAssignment } from '../../entities/ct-assignment.entity';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Section, ClassSlot, CourseSectionTeacher, CTAssignment])],
  controllers: [SectionsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
