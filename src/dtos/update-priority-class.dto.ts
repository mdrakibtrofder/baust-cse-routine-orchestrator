import { PartialType } from '@nestjs/mapped-types';
import { CreatePriorityClassDto } from './priority-class.dto';

export class UpdatePriorityClassDto extends PartialType(CreatePriorityClassDto) {}
