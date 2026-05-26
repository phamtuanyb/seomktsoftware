import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PLAN_TIERS,
  QUOTA_PERIODS,
  QUOTA_RESOURCES,
  SUBSCRIPTION_STATUSES,
  USER_ROLES,
  type PlanTier,
  type QuotaPeriod,
  type QuotaResource,
  type SubscriptionStatus,
  type UserRole,
} from '@mkt-seo/shared';

export class ListUsersQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({ required: false, minimum: 1, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({ required: false, description: 'Substring match on email or name.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiProperty({ required: false, enum: USER_ROLES })
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @ApiProperty({ required: false, enum: PLAN_TIERS })
  @IsOptional()
  @IsIn(PLAN_TIERS)
  plan?: PlanTier;
}

export class UpdateUserDto {
  @ApiProperty({ required: false, enum: USER_ROLES })
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @ApiProperty({ required: false, description: 'Mark email as verified (admin override).' })
  @IsOptional()
  @IsBoolean()
  email_verified?: boolean;

  @ApiProperty({ required: false, description: 'Soft-delete the user (deleted_at = now).' })
  @IsOptional()
  @IsBoolean()
  soft_delete?: boolean;
}

export class OverrideSubscriptionDto {
  @ApiProperty({ enum: PLAN_TIERS })
  @IsIn(PLAN_TIERS)
  plan!: PlanTier;

  @ApiProperty({ required: false, enum: SUBSCRIPTION_STATUSES, default: 'active' })
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: SubscriptionStatus;

  @ApiProperty({ required: false, description: 'ISO date; null = never expires.' })
  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class OverrideQuotaDto {
  @ApiProperty({ enum: QUOTA_RESOURCES })
  @IsIn(QUOTA_RESOURCES)
  resource!: QuotaResource;

  @ApiProperty({ enum: QUOTA_PERIODS })
  @IsIn(QUOTA_PERIODS)
  period!: QuotaPeriod;

  @ApiProperty({ description: '-1 = unlimited, else the new cap.' })
  @IsInt()
  @Min(-1)
  limit_value!: number;

  @ApiProperty({ required: false, description: 'Reset used → 0 when true.' })
  @IsOptional()
  @IsBoolean()
  reset_used?: boolean;
}
