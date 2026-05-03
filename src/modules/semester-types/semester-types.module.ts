import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemesterType } from '../../entities/semester-type.entity';
import { SemesterTypesService } from './semester-types.service';
import { SemesterTypesController } from './semester-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SemesterType])],
  controllers: [SemesterTypesController],
  providers: [SemesterTypesService],
  exports: [SemesterTypesService],
})
export class SemesterTypesModule {}
