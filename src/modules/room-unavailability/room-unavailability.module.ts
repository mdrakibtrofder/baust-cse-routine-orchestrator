import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomUnavailability } from '../../entities/room-unavailability.entity';
import { RoomUnavailabilityController } from './room-unavailability.controller';
import { RoomUnavailabilityService } from './room-unavailability.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoomUnavailability])],
  controllers: [RoomUnavailabilityController],
  providers: [RoomUnavailabilityService],
  exports: [RoomUnavailabilityService],
})
export class RoomUnavailabilityModule {}
