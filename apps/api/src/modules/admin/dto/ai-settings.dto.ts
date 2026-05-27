import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const AI_PROVIDERS = ['claude', 'openai', 'gemini'] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

export class UpdateAiSettingsDto {
  @ApiProperty({ required: false, enum: AI_PROVIDERS })
  @IsOptional()
  @IsIn(AI_PROVIDERS as unknown as string[])
  default_provider?: AiProviderName;

  @ApiProperty({ required: false, description: 'Anthropic API key. Empty string keeps existing.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  claude_api_key?: string;

  @ApiProperty({ required: false, description: 'OpenAI API key. Empty string keeps existing.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  openai_api_key?: string;

  @ApiProperty({ required: false, description: 'Google Gemini API key. Empty string keeps existing.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  gemini_api_key?: string;
}
