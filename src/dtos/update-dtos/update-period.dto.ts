import { PartialType } from '@nestjs/mapped-types';
import { CreatePeriodDto } from '../period.dto';

export class UpdatePeriodDto extends PartialType(CreatePeriodDto) {}
