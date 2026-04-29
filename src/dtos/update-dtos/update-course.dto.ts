import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseDto } from '../course.dto';

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
