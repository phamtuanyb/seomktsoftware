import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OUTLINE_FORMATS, type OutlineFormat } from './generate-outline.dto';

class OutlineSubsectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  h3!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(8)
  bullets!: string[];
}

class OutlineSectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  h2!: string;

  @ApiProperty({ type: [OutlineSubsectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutlineSubsectionDto)
  @ArrayMaxSize(6)
  subsections!: OutlineSubsectionDto[];
}

class OutlineDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  h1!: string;

  @ApiProperty({ type: [OutlineSectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutlineSectionDto)
  @ArrayMaxSize(12)
  sections!: OutlineSectionDto[];
}

export const ARTICLE_TONES = [
  'expert',
  'friendly',
  'sales',
  'educational',
  'storytelling',
] as const;
export type ArticleTone = (typeof ARTICLE_TONES)[number];

export const ARTICLE_MODELS = [
  'claude-sonnet-4',
  'claude-haiku',
  'gpt-4o',
  'gpt-4o-mini',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'yescale-gpt-4.1-mini',
] as const;
export type ArticleModel = (typeof ARTICLE_MODELS)[number];

/** Section 8 TN4 request body. */
export class GenerateArticleDto {
  @ApiProperty({ description: 'Outline produced by /content/outline (same shape).' })
  @IsObject()
  @ValidateNested()
  @Type(() => OutlineDto)
  outline!: OutlineDto;

  @ApiProperty({ description: 'Target keyword from the outline.', required: true })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  keyword!: string;

  @ApiProperty({ required: false, description: 'Brand voice id from TN5.' })
  @IsOptional()
  @IsUUID()
  brand_voice_id?: string;

  @ApiProperty({ required: false, enum: ARTICLE_TONES })
  @IsOptional()
  @IsIn(ARTICLE_TONES as unknown as string[])
  tone?: ArticleTone;

  @ApiProperty({ required: false, enum: OUTLINE_FORMATS, default: 'blog' })
  @IsOptional()
  @IsIn(OUTLINE_FORMATS as unknown as string[])
  format?: OutlineFormat;

  @ApiProperty({ required: false, default: 2000, minimum: 1500, maximum: 5000 })
  @IsOptional()
  @IsInt()
  @Min(1500)
  @Max(5000)
  target_word_count?: number;

  @ApiProperty({ required: false, enum: ARTICLE_MODELS, default: 'claude-sonnet-4' })
  @IsOptional()
  @IsIn(ARTICLE_MODELS as unknown as string[])
  model?: ArticleModel;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  enable_schema_markup?: boolean;

  @ApiProperty({ required: false, default: 'vi' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
}
