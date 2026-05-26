import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { PublishStatus } from '../adapters/publisher.interface';

export const PUBLISH_STATUSES = ['draft', 'publish', 'future'] as const;

/** Section 8 TN8 — POST /publisher/wordpress request. */
export class PublishWordpressDto {
  @ApiProperty()
  @IsUUID()
  article_id!: string;

  @ApiProperty()
  @IsUUID()
  site_id!: string;

  @ApiProperty({ required: false, enum: PUBLISH_STATUSES, default: 'publish' })
  @IsOptional()
  @IsIn(PUBLISH_STATUSES as unknown as string[])
  status?: PublishStatus;

  @ApiProperty({
    required: false,
    description: 'Required when status="future". ISO-8601 timestamp in the user timezone.',
  })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  categories?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tags?: string[];

  @ApiProperty({
    required: false,
    description: 'Image id to use as featured. Falls back to article.featured_image_id.',
  })
  @IsOptional()
  @IsUUID()
  featured_image_id?: string;
}

/** Section 8 TN8 — POST /publisher/bulk request. */
export class BulkPublishJobDto extends PublishWordpressDto {}

export class BulkPublishDto {
  @ApiProperty({ type: [BulkPublishJobDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkPublishJobDto)
  jobs!: BulkPublishJobDto[];
}
