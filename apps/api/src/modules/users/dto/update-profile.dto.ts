import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Section 6 — PATCH /users/me request body. */
export class UpdateProfileDto {
  @ApiProperty({ required: false, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false, maxLength: 20, example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[+0-9 ()-]{6,20}$/, { message: 'phone không hợp lệ' })
  phone?: string;

  @ApiProperty({ required: false, description: 'Avatar URL (https only).' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  avatar_url?: string;

  @ApiProperty({
    required: false,
    description:
      'Free-form preferences (theme, language, default brand voice, default LLM, notifications…).',
  })
  @IsOptional()
  @IsObject()
  preferences_json?: Record<string, unknown>;
}
