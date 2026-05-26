import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { BrandVoicesController } from './brand-voices.controller';
import { BrandVoicesService } from './brand-voices.service';
import { ProfileTrainerService } from './services/profile-trainer.service';
import { UrlFetcherService } from './services/url-fetcher.service';

@Module({
  // LlmModule provides LlmRegistry which ProfileTrainerService consumes
  // (Claude Sonnet 4 → BrandVoiceProfile JSON).
  imports: [LlmModule],
  controllers: [BrandVoicesController],
  providers: [BrandVoicesService, ProfileTrainerService, UrlFetcherService],
  exports: [BrandVoicesService, ProfileTrainerService],
})
export class BrandVoicesModule {}
