import { Module } from '@nestjs/common';
import { BrandVoicesController } from './brand-voices.controller';

@Module({ controllers: [BrandVoicesController] })
export class BrandVoicesModule {}
