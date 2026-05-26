import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Section 8 TN7 — POST /audit/score request body. */
export class ScoreContentDto {
  @ApiProperty({ required: false, description: 'Pass an article_id to skip raw HTML payload.' })
  @IsOptional()
  @IsUUID()
  article_id?: string;

  @ApiProperty({
    required: false,
    description: 'Plain title text — required when article_id absent.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiProperty({ required: false, description: 'HTML body — required when article_id absent.' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    required: false,
    description:
      'Markdown body. Sprint 6.6 — live editor preview score. Server converts to HTML before running rules. Use this OR content, not both.',
  })
  @IsOptional()
  @IsString()
  content_markdown?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  meta_title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meta_description?: string;

  @ApiProperty({ description: 'Primary target keyword.', minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  target_keyword!: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  secondary_keywords?: string[];

  @ApiProperty({ required: false, enum: ['info', 'commercial', 'transactional', 'navigational'] })
  @IsOptional()
  @IsIn(['info', 'commercial', 'transactional', 'navigational'])
  intent?: 'info' | 'commercial' | 'transactional' | 'navigational';

  @ApiProperty({
    required: false,
    description: 'Base URL of the user site — used to classify internal vs external links.',
  })
  @IsOptional()
  @IsUrl({ require_protocol: false })
  base_url?: string;
}

/** Section 8 TN7 — POST /audit/auto-fix request body. */
export class AutoFixDto {
  @ApiProperty({ description: 'Article id to load + persist back to.' })
  @IsUUID()
  article_id!: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Restrict the fix to these rule ids (default: every rule with score <80).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  rule_ids?: string[];
}
