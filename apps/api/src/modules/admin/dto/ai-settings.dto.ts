import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PROVIDER_MODEL_OPTIONS,
  type ProviderModel,
} from '../../content/providers/llm-provider.interface';

export const AI_PROVIDERS = ['claude', 'openai', 'gemini', 'yescale'] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

export class AiProviderConfigDto {
  @ApiProperty({ required: false, description: 'Config id for editing an existing key entry.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  id?: string;

  @ApiProperty({ description: 'Human label shown in admin, e.g. Team A / Primary / Backup.' })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ enum: Object.values(PROVIDER_MODEL_OPTIONS).flat() })
  @IsString()
  @IsIn(Object.values(PROVIDER_MODEL_OPTIONS).flat() as string[])
  model!: ProviderModel;

  @ApiProperty({
    required: false,
    description: 'API key. Empty keeps existing key for edited rows; required for new rows.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  api_key?: string;

  @ApiProperty({
    required: false,
    description: 'Marks this config as the default for its provider.',
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class UpdateAiSettingsDto {
  @ApiProperty({ required: false, enum: AI_PROVIDERS })
  @IsOptional()
  @IsIn(AI_PROVIDERS as unknown as string[])
  default_provider?: AiProviderName;

  @ApiProperty({ required: false, type: [AiProviderConfigDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiProviderConfigDto)
  claude_configs?: AiProviderConfigDto[];

  @ApiProperty({ required: false, type: [AiProviderConfigDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiProviderConfigDto)
  openai_configs?: AiProviderConfigDto[];

  @ApiProperty({ required: false, type: [AiProviderConfigDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiProviderConfigDto)
  gemini_configs?: AiProviderConfigDto[];

  @ApiProperty({ required: false, type: [AiProviderConfigDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiProviderConfigDto)
  yescale_configs?: AiProviderConfigDto[];
}
