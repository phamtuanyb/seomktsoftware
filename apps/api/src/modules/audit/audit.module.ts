import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './services/audit.service';
import { SCORING_RULES } from './rules/base.rule';
import { KeywordDensityRule } from './rules/keyword-density.rule';
import { TitleKeywordRule } from './rules/title-keyword.rule';
import { MetaDescriptionRule } from './rules/meta-description.rule';
import { H1UniqueRule } from './rules/h1-unique.rule';
import { HeadingStructureRule } from './rules/heading-structure.rule';
import { WordCountRule } from './rules/word-count.rule';
import { LinksRule } from './rules/links.rule';
import { ImagesAltRule } from './rules/images-alt.rule';
import { SchemaMarkupRule } from './rules/schema-markup.rule';
import { LsiKeywordsRule } from './rules/lsi-keywords.rule';
import { IntroHookRule } from './rules/intro-hook.rule';
import { FaqSectionRule } from './rules/faq-section.rule';

/** Section 8 TN7 — wires all 12 ScoringRules into the SCORING_RULES array. */
@Module({
  controllers: [AuditController],
  providers: [
    KeywordDensityRule,
    TitleKeywordRule,
    MetaDescriptionRule,
    H1UniqueRule,
    HeadingStructureRule,
    WordCountRule,
    LinksRule,
    ImagesAltRule,
    SchemaMarkupRule,
    LsiKeywordsRule,
    IntroHookRule,
    FaqSectionRule,
    {
      provide: SCORING_RULES,
      useFactory: (
        a: KeywordDensityRule,
        b: TitleKeywordRule,
        c: MetaDescriptionRule,
        d: H1UniqueRule,
        e: HeadingStructureRule,
        f: WordCountRule,
        g: LinksRule,
        h: ImagesAltRule,
        i: SchemaMarkupRule,
        j: LsiKeywordsRule,
        k: IntroHookRule,
        l: FaqSectionRule,
      ) => [a, b, c, d, e, f, g, h, i, j, k, l],
      inject: [
        KeywordDensityRule,
        TitleKeywordRule,
        MetaDescriptionRule,
        H1UniqueRule,
        HeadingStructureRule,
        WordCountRule,
        LinksRule,
        ImagesAltRule,
        SchemaMarkupRule,
        LsiKeywordsRule,
        IntroHookRule,
        FaqSectionRule,
      ],
    },
    AuditService,
  ],
  exports: [AuditService],
})
export class AuditModule {}
