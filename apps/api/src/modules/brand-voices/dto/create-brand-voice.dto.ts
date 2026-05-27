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
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidateNested,
} from 'class-validator';

const MIN_SAMPLE_WORDS = 500;
const MAX_SAMPLE_WORDS = 3000;

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function MinWords(min: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'minWords',
      target: object.constructor,
      propertyName,
      constraints: [min],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && countWords(value) >= min;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must contain at least ${args.constraints[0]} words`;
        },
      },
    });
  };
}

function MaxWords(max: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxWords',
      target: object.constructor,
      propertyName,
      constraints: [max],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && countWords(value) <= max;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must contain at most ${args.constraints[0]} words`;
        },
      },
    });
  };
}

class SampleArticleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiProperty({
    required: false,
    description: 'Inline article content (500-3000 words) OR provide url to fetch via readability.',
  })
  @IsOptional()
  @IsString()
  @MinWords(MIN_SAMPLE_WORDS, {
    message: `content phải có tối thiểu ${MIN_SAMPLE_WORDS} từ hoặc cung cấp url.`,
  })
  @MaxWords(MAX_SAMPLE_WORDS, {
    message: `content chỉ được tối đa ${MAX_SAMPLE_WORDS} từ hoặc cung cấp url.`,
  })
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
    description: 'Spec TN5: 3-20 sample articles. Each needs either content (500-3000 words) or url.',
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
