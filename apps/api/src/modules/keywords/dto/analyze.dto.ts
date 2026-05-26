import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Section 8 TN2 request. */
export class AnalyzeKeywordsDto {
  @ApiProperty({ type: [String], description: 'Up to 500 keywords per request.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(500, { each: true })
  keywords!: string[];

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  analyze_intent?: boolean;

  @ApiProperty({ required: false, default: 'vi' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiProperty({ required: false, default: 'VN' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string;

  @ApiProperty({
    required: false,
    description:
      'Optional project id — if provided, the corresponding keyword rows are updated with the analysis result.',
  })
  @IsOptional()
  @IsUUID()
  project_id?: string;
}
