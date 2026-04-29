import { PartialType } from '@nestjs/mapped-types';
import { CreateSectionDto } from '../section.dto';

export class UpdateSectionDto extends PartialType(CreateSectionDto) {}
