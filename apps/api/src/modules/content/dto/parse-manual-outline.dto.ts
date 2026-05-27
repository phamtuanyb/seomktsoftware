import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsIn } from 'class-validator';
import { OUTLINE_FORMATS, type OutlineFormat } from './generate-outline.dto';

export class ParseManualOutlineDto {
  @ApiProperty({ minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  keyword!: string;

  @ApiProperty({ description: 'Paste outline text with Meta Title/H1/H2/H3 or markdown headings.' })
  @IsString()
  @MinLength(10)
  raw_outline!: string;

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
}
