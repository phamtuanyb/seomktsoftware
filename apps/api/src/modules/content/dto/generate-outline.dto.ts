import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const OUTLINE_INTENTS = ['info', 'commercial', 'transactional', 'navigational'] as const;
export type OutlineIntent = (typeof OUTLINE_INTENTS)[number];

export const OUTLINE_FORMATS = [
  'blog',
  'listicle',
  'how-to',
  'review',
  'comparison',
  'faq',
  'landing',
  'product',
] as const;
export type OutlineFormat = (typeof OUTLINE_FORMATS)[number];

/** Section 8 TN3 request body. */
export class GenerateOutlineDto {
  @ApiProperty({ example: 'SEO local cho doanh nghiệp nhỏ', minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  keyword!: string;

  @ApiProperty({ required: false, enum: OUTLINE_INTENTS })
  @IsOptional()
  @IsIn(OUTLINE_INTENTS as unknown as string[])
  intent?: OutlineIntent;

  @ApiProperty({ required: false, enum: OUTLINE_FORMATS, default: 'blog' })
  @IsOptional()
  @IsIn(OUTLINE_FORMATS as unknown as string[])
  format?: OutlineFormat;

  @ApiProperty({ required: false, minimum: 1500, maximum: 5000, default: 2000 })
  @IsOptional()
  @IsInt()
  @Min(1500)
  @Max(5000)
  target_word_count?: number;

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
}
