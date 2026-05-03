import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Year } from '../../entities/year.entity';
import { YearsService } from './years.service';
import { YearsController } from './years.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Year])],
  controllers: [YearsController],
  providers: [YearsService],
  exports: [YearsService],
})
export class YearsModule {}
