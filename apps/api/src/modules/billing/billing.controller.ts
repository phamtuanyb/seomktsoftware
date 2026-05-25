import { Controller, Get, NotImplementedException, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  @Get('subscription')
  @ApiOperation({ summary: 'Current subscription + remaining quotas' })
  getSubscription(): never {
    throw new NotImplementedException('Pending Sprint 3+ (Stripe/Sepay)');
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  checkout(): never {
    throw new NotImplementedException('Pending Sprint 3+ (Stripe/Sepay)');
  }

  @Post('webhooks/stripe')
  @ApiOperation({ summary: 'Stripe webhook listener' })
  stripeWebhook(): never {
    throw new NotImplementedException('Pending Sprint 3+ (Stripe/Sepay)');
  }
}
