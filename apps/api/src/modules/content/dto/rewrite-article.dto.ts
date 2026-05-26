import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ARTICLE_TONES, type ArticleTone } from './generate-article.dto';

/** Sprint 6.5 — regenerate just one ## H2 section, keep the heading. */
export class RegenerateSectionDto {
  @ApiProperty({
    description: 'Exact H2 heading text (without the ## prefix). Used to locate the section.',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  section_heading!: string;

  @ApiProperty({
    required: false,
    description: 'Extra guidance to inject into the LLM prompt for THIS regeneration only.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @ApiProperty({ required: false, enum: ARTICLE_TONES })
  @IsOptional()
  @IsIn(ARTICLE_TONES as unknown as string[])
  tone?: ArticleTone;
}

export const REWRITE_ACTIONS = ['shorter', 'longer', 'tone', 'details', 'free'] as const;
export type RewriteAction = (typeof REWRITE_ACTIONS)[number];

/**
 * Sprint 6.5 — rewrite either selected text or a whole section.
 *
 * When `text` is provided, the response includes just the rewritten string;
 * the editor swaps it in. When `text` is absent the server uses the article's
 * content_markdown verbatim and returns the rewritten article.
 */
export class RewriteDto {
  @ApiProperty({ enum: REWRITE_ACTIONS })
  @IsIn(REWRITE_ACTIONS as unknown as string[])
  action!: RewriteAction;

  @ApiProperty({
    required: false,
    description:
      'Plain text to rewrite. Required when action != "free" for selection mode. Length 5-5000.',
    minLength: 5,
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  text?: string;

  @ApiProperty({
    required: false,
    enum: ARTICLE_TONES,
    description: "Target tone when action='tone'.",
  })
  @IsOptional()
  @IsIn(ARTICLE_TONES as unknown as string[])
  tone?: ArticleTone;

  @ApiProperty({
    required: false,
    description: 'Free-form instructions, used when action="free" or to supplement other actions.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @ApiProperty({
    required: false,
    description:
      'When true, also writes the rewritten content back to the article (whole-article mode).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  apply?: number;
}
