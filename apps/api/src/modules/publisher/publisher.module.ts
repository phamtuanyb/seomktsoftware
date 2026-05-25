import { Module } from '@nestjs/common';
import { PublisherController } from './publisher.controller';

@Module({ controllers: [PublisherController] })
export class PublisherModule {}
