import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAppSettingDto {
  @IsOptional()
  @IsBoolean()
  show_break_column?: boolean;
}
