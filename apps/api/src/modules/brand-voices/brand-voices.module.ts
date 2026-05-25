import { Module } from '@nestjs/common';
import { BrandVoicesController } from './brand-voices.controller';
import { BrandVoicesService } from './brand-voices.service';

@Module({
  controllers: [BrandVoicesController],
  providers: [BrandVoicesService],
  exports: [BrandVoicesService],
})
export class BrandVoicesModule {}
