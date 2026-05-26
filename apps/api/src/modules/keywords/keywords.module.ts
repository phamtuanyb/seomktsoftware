import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { KeywordsController } from './keywords.controller';
import { KeywordProxyService } from './providers/proxy.service';
import { GoogleSuggestProvider } from './providers/google-suggest.provider';
import { BingSuggestProvider } from './providers/bing-suggest.provider';
import { PaaProvider } from './providers/paa.provider';
import { DataForSeoVolumeProvider } from './providers/volume.provider';
import { SuggestionService } from './services/suggestion.service';
import { KeywordProjectsService } from './services/projects.service';
import { KeywordExportService } from './services/export.service';
import { KdCalculatorService } from './services/kd-calculator.service';
import { IntentClassifierService } from './services/intent-classifier.service';
import { AnalysisService } from './services/analysis.service';

@Module({
  // ContentModule exports LlmRegistry which IntentClassifierService depends on.
  imports: [ContentModule],
  controllers: [KeywordsController],
  providers: [
    KeywordProxyService,
    GoogleSuggestProvider,
    BingSuggestProvider,
    PaaProvider,
    DataForSeoVolumeProvider,
    SuggestionService,
    KeywordProjectsService,
    KeywordExportService,
    KdCalculatorService,
    IntentClassifierService,
    AnalysisService,
  ],
  exports: [SuggestionService, AnalysisService, KeywordProjectsService],
})
export class KeywordsModule {}
