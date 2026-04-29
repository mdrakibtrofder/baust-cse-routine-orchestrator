import { PartialType } from '@nestjs/mapped-types';
import { CreateSemesterDto } from '../semester.dto';

export class UpdateSemesterDto extends PartialType(CreateSemesterDto) {}
