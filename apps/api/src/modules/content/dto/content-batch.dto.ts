import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { OUTLINE_FORMATS, type OutlineFormat } from './generate-outline.dto';
import { IsIn } from 'class-validator';

export class CreateContentBatchJobDto {
  @ApiProperty({
    description: 'One keyword per line. Items are processed in the same order.',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  keywords_text!: string;

  @ApiProperty({ required: false, enum: OUTLINE_FORMATS, default: 'blog' })
  @IsOptional()
  @IsIn(OUTLINE_FORMATS as unknown as string[])
  format?: OutlineFormat;

  @ApiProperty({ required: false, default: 2000, minimum: 1500, maximum: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1500)
  @Max(5000)
  target_word_count?: number;

  @ApiProperty({ required: false, default: 'vi', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiProperty({ required: false, description: 'Optional brand voice applied to all items.' })
  @IsOptional()
  @IsUUID()
  brand_voice_id?: string;
}

export class ListContentBatchJobsQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
