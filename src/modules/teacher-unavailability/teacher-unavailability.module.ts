import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherUnavailability } from '../../entities/teacher-unavailability.entity';
import { TeacherUnavailabilityController } from './teacher-unavailability.controller';
import { TeacherUnavailabilityService } from './teacher-unavailability.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherUnavailability])],
  controllers: [TeacherUnavailabilityController],
  providers: [TeacherUnavailabilityService],
  exports: [TeacherUnavailabilityService],
})
export class TeacherUnavailabilityModule {}
