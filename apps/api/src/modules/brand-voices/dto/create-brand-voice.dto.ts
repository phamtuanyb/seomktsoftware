import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class SampleArticleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiProperty({
    required: false,
    description: 'Inline article content (≥500 chars) OR provide url.',
  })
  @IsOptional()
  @IsString()
  @MinLength(500)
  content?: string;

  @ApiProperty({
    required: false,
    description: 'Public URL — content will be fetched at training time.',
  })
  @IsOptional()
  @IsUrl()
  url?: string;
}

/** Section 8 TN5 request body. */
export class CreateBrandVoiceDto {
  @ApiProperty({ example: 'Tech blog tone', maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ required: false, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    type: [SampleArticleDto],
    description: 'Spec TN5: 3-20 sample articles. Each needs either content (≥500 chars) or url.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SampleArticleDto)
  @ArrayMinSize(3)
  @ArrayMaxSize(20)
  sample_articles!: SampleArticleDto[];

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiProperty({
    required: false,
    description: 'Pre-built profile JSON (Sprint 5.6 ships read/CRUD; training algo lands later).',
  })
  @IsOptional()
  @IsObject()
  profile_json?: Record<string, unknown>;
}

export class UpdateBrandVoiceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  profile_json?: Record<string, unknown>;
}
