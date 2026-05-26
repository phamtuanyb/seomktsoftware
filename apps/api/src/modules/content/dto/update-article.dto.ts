import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Section 8 TN4 / Sprint 11 — editor save body. All fields optional (partial update). */
export class UpdateArticleDto {
  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiProperty({ required: false, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiProperty({ required: false, description: 'Source of truth — HTML is re-rendered from this.' })
  @IsOptional()
  @IsString()
  content_markdown?: string;

  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  meta_title?: string;

  @ApiProperty({ required: false, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  meta_description?: string;

  @ApiProperty({ required: false, enum: ['draft', 'ready', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'ready', 'published'])
  status?: 'draft' | 'ready' | 'published';

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  word_count?: number;
}

export class ListArticlesQueryDto {
  @ApiProperty({ required: false, description: 'Opaque cursor from previous response.' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({ required: false, minimum: 1, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({ required: false, enum: ['draft', 'ready', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'ready', 'published'])
  status?: 'draft' | 'ready' | 'published';

  @ApiProperty({ required: false, description: 'Substring match on title or target_keyword.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_score?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_score?: number;
}
