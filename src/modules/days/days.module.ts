import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Day } from '../../entities/day.entity';
import { DaysService } from './days.service';
import { DaysController } from './days.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Day])],
  controllers: [DaysController],
  providers: [DaysService],
  exports: [DaysService],
})
export class DaysModule {}
