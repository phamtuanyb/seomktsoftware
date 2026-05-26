import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import type { PublisherType } from '../adapters/publisher.interface';

export const PUBLISHER_TYPES = ['wordpress'] as const;

/** Section 8 TN8 — connect site request. */
export class CreateSiteDto {
  @ApiProperty({ example: 'https://my-blog.example.com' })
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  url!: string;

  @ApiProperty({
    required: false,
    enum: PUBLISHER_TYPES,
    default: 'wordpress',
    description: 'Phase 2 brings shopify/haravan/sapo/webflow.',
  })
  @IsOptional()
  @IsIn(PUBLISHER_TYPES as unknown as string[])
  type?: PublisherType;

  @ApiProperty({ required: false, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  username!: string;

  @ApiProperty({ description: 'WordPress Application Password (5.6+).' })
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  application_password!: string;
}

export class UpdateSiteDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @ApiProperty({ required: false, description: 'Provide to rotate the Application Password.' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  application_password?: string;
}
