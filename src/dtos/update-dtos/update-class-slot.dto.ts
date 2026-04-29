import { PartialType } from '@nestjs/mapped-types';
import { CreateClassSlotDto } from '../class-slot.dto';

export class UpdateClassSlotDto extends PartialType(CreateClassSlotDto) {}
