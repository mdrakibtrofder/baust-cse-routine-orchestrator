import { PartialType } from '@nestjs/mapped-types';
import { CreateDepartmentDto } from '../department.dto';

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}
