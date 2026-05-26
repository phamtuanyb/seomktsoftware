import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const FORMATS = [
  'blog',
  'listicle',
  'how-to',
  'review',
  'comparison',
  'faq',
  'landing',
  'product',
] as const;

/** Section 3 end-to-end pipeline kick-off body. */
export class StartPipelineRunDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  keyword!: string;

  @ApiProperty({ required: false, enum: FORMATS, default: 'blog' })
  @IsOptional()
  @IsIn(FORMATS)
  format?: (typeof FORMATS)[number];

  @ApiProperty({ required: false, default: 2000, minimum: 500, maximum: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(5000)
  target_word_count?: number;

  @ApiProperty({
    required: false,
    description: 'Brand voice to imitate. Falls back to plain Claude tone when omitted.',
  })
  @IsOptional()
  @IsUUID()
  brand_voice_id?: string;

  @ApiProperty({
    required: false,
    enum: ['claude-sonnet-4', 'claude-haiku', 'gpt-4o'],
    default: 'claude-sonnet-4',
  })
  @IsOptional()
  @IsIn(['claude-sonnet-4', 'claude-haiku', 'gpt-4o'])
  model?: 'claude-sonnet-4' | 'claude-haiku' | 'gpt-4o';

  @ApiProperty({ required: false, default: true, description: 'Run TN6 image generation step.' })
  @IsOptional()
  @IsBoolean()
  generate_images?: boolean;

  @ApiProperty({
    required: false,
    description: 'WordPress site id. When present, run TN8 publish step (default status=draft).',
  })
  @IsOptional()
  @IsUUID()
  site_id?: string;

  @ApiProperty({
    required: false,
    enum: ['draft', 'publish'],
    default: 'draft',
    description:
      'WP publish status — auto pipelines default to draft so users review before going live.',
  })
  @IsOptional()
  @IsIn(['draft', 'publish'])
  publish_status?: 'draft' | 'publish';
}

export class ListRunsQueryDto {
  @ApiProperty({ required: false, minimum: 1, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({
    required: false,
    enum: ['pending', 'running', 'succeeded', 'failed', 'cancelled'],
  })
  @IsOptional()
  @IsIn(['pending', 'running', 'succeeded', 'failed', 'cancelled'])
  status?: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
}
