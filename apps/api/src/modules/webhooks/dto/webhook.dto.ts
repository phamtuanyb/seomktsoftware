import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

/**
 * HTTPS-only in production but allows http://localhost or http://127.0.0.1
 * so dev/test infra (local n8n, supertest receivers) can connect without
 * cert juggling.
 */
function IsWebhookUrl(opts?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isWebhookUrl',
      target: object.constructor,
      propertyName,
      options: opts,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          let parsed: URL;
          try {
            parsed = new URL(value);
          } catch {
            return false;
          }
          if (parsed.protocol === 'https:') return true;
          if (parsed.protocol === 'http:') {
            return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
          }
          return false;
        },
        defaultMessage() {
          return 'url phải là https:// (http chỉ chấp nhận với localhost/127.0.0.1)';
        },
      },
    });
  };
}

/**
 * Section 6 spec — `Webhook Events (outgoing payloads)`. Keep in sync with
 * the dispatcher event listeners.
 */
export const WEBHOOK_EVENTS = [
  'article.created',
  'article.completed',
  'article.published',
  'publish.failed',
  'brand_voice.trained',
  'image.generated',
  'keywords.suggested',
  'user.registered',
  'quota.warning',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export class CreateWebhookDto {
  @ApiProperty({
    example: 'https://n8n.mydomain.com/webhook/article-published',
    description:
      'HTTPS URL the platform POSTs to when subscribed events fire (http allowed only for localhost).',
  })
  @IsWebhookUrl()
  url!: string;

  @ApiProperty({ enum: WEBHOOK_EVENTS, isArray: true, minLength: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(WEBHOOK_EVENTS.length)
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: WebhookEvent[];

  @ApiProperty({
    required: false,
    description:
      'Shared secret used to HMAC-SHA256 the payload (Section 17). If omitted, one is auto-generated and returned.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  secret?: string;
}

export class UpdateWebhookDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsWebhookUrl()
  url?: string;

  @ApiProperty({ required: false, enum: WEBHOOK_EVENTS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(WEBHOOK_EVENTS.length)
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: WebhookEvent[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  secret?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ListDeliveriesQueryDto {
  @ApiProperty({ required: false, minimum: 1, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
