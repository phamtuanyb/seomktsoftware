import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { KEYWORD_SOURCES } from './suggest.dto';
import type { KeywordSourceName } from '../providers/keyword-source.interface';

export class CreateProjectDto {
  @ApiProperty({ example: 'SEO local Q2 2026', maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ required: false, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seed_keyword?: string;

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

export class UpdateProjectDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seed_keyword?: string;
}

export class AddKeywordsDto {
  @ApiProperty({ type: [String], description: 'Keywords to attach (max 2000).' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  keywords!: string[];

  @ApiProperty({ required: false, enum: KEYWORD_SOURCES, default: 'manual' })
  @IsOptional()
  @IsIn([...KEYWORD_SOURCES, 'manual'] as unknown as string[])
  source?: KeywordSourceName | 'manual';
}
