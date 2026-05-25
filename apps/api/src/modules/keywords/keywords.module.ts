import { Module } from '@nestjs/common';
import { KeywordsController } from './keywords.controller';
import { KeywordProxyService } from './providers/proxy.service';
import { GoogleSuggestProvider } from './providers/google-suggest.provider';
import { BingSuggestProvider } from './providers/bing-suggest.provider';
import { PaaProvider } from './providers/paa.provider';
import { SuggestionService } from './services/suggestion.service';
import { KeywordProjectsService } from './services/projects.service';
import { KeywordExportService } from './services/export.service';

@Module({
  controllers: [KeywordsController],
  providers: [
    KeywordProxyService,
    GoogleSuggestProvider,
    BingSuggestProvider,
    PaaProvider,
    SuggestionService,
    KeywordProjectsService,
    KeywordExportService,
  ],
  exports: [SuggestionService, KeywordProjectsService],
})
export class KeywordsModule {}
