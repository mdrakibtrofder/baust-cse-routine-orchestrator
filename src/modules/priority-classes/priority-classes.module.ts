import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriorityClassesService } from './priority-classes.service';
import { PriorityClassesController } from './priority-classes.controller';
import { PriorityClass } from '../../entities/priority-class.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PriorityClass])],
  controllers: [PriorityClassesController],
  providers: [PriorityClassesService],
  exports: [PriorityClassesService, TypeOrmModule],
})
export class PriorityClassesModule {}
