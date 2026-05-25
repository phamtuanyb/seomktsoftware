import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { KeywordSourceName } from '../providers/keyword-source.interface';

export const KEYWORD_SOURCES = ['google_suggest', 'bing_suggest', 'paa'] as const;

/** Section 8 TN1 request. */
export class SuggestKeywordsDto {
  @ApiProperty({ example: 'SEO local cho doanh nghiệp nhỏ', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  seed!: string;

  @ApiProperty({
    required: false,
    isArray: true,
    enum: KEYWORD_SOURCES,
    default: ['google_suggest', 'bing_suggest', 'paa'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(KEYWORD_SOURCES as unknown as string[], { each: true })
  sources?: KeywordSourceName[];

  @ApiProperty({ required: false, default: 'vi', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiProperty({ required: false, default: 'VN', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string;

  @ApiProperty({ required: false, default: 500, minimum: 10, maximum: 2000 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(2000)
  limit?: number;
}
