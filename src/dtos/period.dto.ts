import { IsString, Matches, IsInt, Min, IsEnum } from 'class-validator';

export class CreatePeriodDto {
  @IsString()
  name: string;

  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'Start time must be HH:MM or HH:MM:SS format' })
  start: string;

  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'End time must be HH:MM or HH:MM:SS format' })
  end: string;

  @IsInt()
  @Min(1)
  duration: number;

  @IsEnum(['theory', 'sessional'])
  kind: 'theory' | 'sessional';
}
