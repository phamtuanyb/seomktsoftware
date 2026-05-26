import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ImagesController } from './images.controller';
import { ImagesService } from './services/images.service';
import { ImageSafetyService } from './services/image-safety.service';
import { AltTextService } from './services/alt-text.service';
import { StorageService } from './storage/storage.service';
import { ImageProcessor } from './storage/image-processor.service';
import { FluxProvider } from './providers/flux.provider';
import { DalleProvider } from './providers/dalle.provider';
import { IMAGE_PROVIDER_FLUX, IMAGE_PROVIDER_DALLE } from './providers/image-provider.interface';

/** Section 8 TN6 — wires Flux/DALL-E providers + storage + safety + alt-text. */
@Module({
  // LlmModule provides LlmRegistry which ImageSafetyService + AltTextService use.
  imports: [LlmModule],
  controllers: [ImagesController],
  providers: [
    FluxProvider,
    DalleProvider,
    { provide: IMAGE_PROVIDER_FLUX, useExisting: FluxProvider },
    { provide: IMAGE_PROVIDER_DALLE, useExisting: DalleProvider },
    StorageService,
    ImageProcessor,
    ImageSafetyService,
    AltTextService,
    ImagesService,
  ],
  exports: [ImagesService],
})
export class ImagesModule {}
