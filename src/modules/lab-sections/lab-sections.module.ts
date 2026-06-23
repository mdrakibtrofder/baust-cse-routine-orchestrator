import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseLabSection } from '../../entities/course-lab-section.entity';
import { ClassSlot } from '../../entities/class-slot.entity';
import { LabSectionsService } from './lab-sections.service';
import { LabSectionsController } from './lab-sections.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CourseLabSection, ClassSlot])],
  providers: [LabSectionsService],
  controllers: [LabSectionsController],
  exports: [LabSectionsService],
})
export class LabSectionsModule {}
