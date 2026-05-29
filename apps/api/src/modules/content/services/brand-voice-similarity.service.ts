import { Injectable } from '@nestjs/common';
import type { BrandVoiceProfileLite, ReferenceArticleLite } from '../prompts/article.prompt';

interface SimilarityMetric {
  score: number;
  passed: boolean;
  note: string;
}

export interface BrandVoiceSimilarityReport {
  score: number;
  breakdown: Record<string, SimilarityMetric>;
  suggestions: string[];
}

interface EvaluateBrandVoiceArgs {
  markdown: string;
  profile: BrandVoiceProfileLite;
  referenceArticles?: ReferenceArticleLite[];
}

@Injectable()
export class BrandVoiceSimilarityService {
  evaluate(args: EvaluateBrandVoiceArgs): BrandVoiceSimilarityReport {
    const plainText = this.toPlainText(args.markdown);
    const metrics: Array<[string, SimilarityMetric]> = [];

    const sentenceMetric = this.evaluateSentenceLength(plainText, args.profile);
    if (sentenceMetric) metrics.push(['sentence_length', sentenceMetric]);

    const paragraphMetric = this.evaluateParagraphRhythm(args.markdown, args.profile);
    if (paragraphMetric) metrics.push(['paragraph_rhythm', paragraphMetric]);

    const signatureMetric = this.evaluatePhraseCoverage(
      plainText,
      args.profile.signature_phrases,
      'Cum tu dac trung cua brand chua xuat hien ro trong bai.',
      'Da giu duoc mot phan cum tu dac trung cua brand.',
    );
    if (signatureMetric) metrics.push(['signature_phrases', signatureMetric]);

    const preferredVocabularyMetric = this.evaluatePhraseCoverage(
      plainText,
      args.profile.vocabulary?.preferred,
      'Tu vung uu tien cua brand xuat hien qua it.',
      'Da dung mot phan tu vung uu tien cua brand.',
    );
    if (preferredVocabularyMetric) metrics.push(['preferred_vocabulary', preferredVocabularyMetric]);

    const avoidedVocabularyMetric = this.evaluateAvoidedPhrases(
      plainText,
      [...(args.profile.vocabulary?.avoided ?? []), ...(args.profile.forbidden_phrases ?? [])],
    );
    if (avoidedVocabularyMetric) metrics.push(['forbidden_phrases', avoidedVocabularyMetric]);

    const transitionMetric = this.evaluatePhraseCoverage(
      plainText,
      args.profile.transitions?.preferred,
      'Cau noi va chuyen doan chua giong cach brand thuong dung.',
      'Da co mot so cum chuyen y dung voi brand.',
    );
    if (transitionMetric) metrics.push(['transitions', transitionMetric]);

    const addressingMetric = this.evaluateAddressing(plainText, args.profile);
    if (addressingMetric) metrics.push(['addressing', addressingMetric]);

    const emojiMetric = this.evaluateEmojiUsage(plainText, args.profile);
    if (emojiMetric) metrics.push(['emoji_usage', emojiMetric]);

    const referenceMetric = this.evaluateReferenceSimilarity(plainText, args.referenceArticles ?? []);
    if (referenceMetric) metrics.push(['reference_overlap', referenceMetric]);

    if (metrics.length === 0) {
      return {
        score: 0,
        breakdown: {},
        suggestions: ['Brand voice chua co du du lieu profile de cham do giong.'],
      };
    }

    const total = metrics.reduce((sum, [, metric]) => sum + metric.score, 0);
    const score = Math.round(total / metrics.length);
    const breakdown = Object.fromEntries(metrics);
    const suggestions = this.buildSuggestions(breakdown);

    return { score, breakdown, suggestions };
  }

  private evaluateSentenceLength(
    plainText: string,
    profile: BrandVoiceProfileLite,
  ): SimilarityMetric | null {
    const target = profile.sentence_structure?.avg_words_per_sentence;
    if (!target) return null;

    const sentences = plainText
      .split(/[.!?]+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    if (!sentences.length) return null;

    const average =
      sentences.reduce((sum, sentence) => sum + this.countWords(sentence), 0) / sentences.length;
    const deviation = Math.abs(average - target);
    const score = Math.max(0, Math.round(100 - (deviation / Math.max(target, 8)) * 100));

    return {
      score,
      passed: score >= 70,
      note: `Cau trung binh ${average.toFixed(1)} tu, profile muc tieu ${target} tu.`,
    };
  }

  private evaluateParagraphRhythm(
    markdown: string,
    profile: BrandVoiceProfileLite,
  ): SimilarityMetric | null {
    const target = profile.paragraph_rhythm?.avg_sentences_per_paragraph;
    if (!target) return null;

    const paragraphs = markdown
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/^#+\s+/gm, '').trim())
      .filter((paragraph) => paragraph.length > 0 && !paragraph.startsWith('- ') && !paragraph.startsWith('|'));
    if (!paragraphs.length) return null;

    const average =
      paragraphs.reduce((sum, paragraph) => sum + this.countSentences(paragraph), 0) / paragraphs.length;
    const deviation = Math.abs(average - target);
    const score = Math.max(0, Math.round(100 - (deviation / Math.max(target, 2)) * 100));

    return {
      score,
      passed: score >= 70,
      note: `Doan van trung binh ${average.toFixed(1)} cau, profile muc tieu ${target} cau/doan.`,
    };
  }

  private evaluatePhraseCoverage(
    plainText: string,
    phrases: string[] | undefined,
    weakNote: string,
    okNote: string,
  ): SimilarityMetric | null {
    const candidates = (phrases ?? []).map((phrase) => phrase.trim()).filter((phrase) => phrase.length >= 2);
    if (!candidates.length) return null;

    const normalized = this.normalize(plainText);
    const hits = candidates.filter((phrase) => normalized.includes(this.normalize(phrase)));
    const ratio = hits.length / candidates.length;
    const score = Math.min(100, Math.round(ratio * 160));

    return {
      score,
      passed: score >= 60,
      note: hits.length
        ? `${okNote} Tim thay ${hits.length}/${candidates.length} cum.`
        : weakNote,
    };
  }

  private evaluateAvoidedPhrases(plainText: string, phrases: string[]): SimilarityMetric | null {
    const candidates = phrases.map((phrase) => phrase.trim()).filter((phrase) => phrase.length >= 2);
    if (!candidates.length) return null;

    const normalized = this.normalize(plainText);
    const matched = candidates.filter((phrase) => normalized.includes(this.normalize(phrase)));
    const penalty = matched.length / candidates.length;
    const score = Math.max(0, Math.round(100 - penalty * 160));

    return {
      score,
      passed: matched.length === 0,
      note: matched.length
        ? `Dang dung cac cum brand muon tranh: ${matched.slice(0, 5).join(', ')}.`
        : 'Khong thay cum tu bi tranh/cam trong bai.',
    };
  }

  private evaluateAddressing(
    plainText: string,
    profile: BrandVoiceProfileLite,
  ): SimilarityMetric | null {
    const cues = [profile.addressing?.primary, profile.addressing?.self_reference]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));
    if (!cues.length) return null;

    const normalized = this.normalize(plainText);
    const hits = cues.filter((cue) => normalized.includes(this.normalize(cue)));
    const score = Math.round((hits.length / cues.length) * 100);

    return {
      score,
      passed: score >= 50,
      note: hits.length
        ? `Da giu mot phan cach xung ho cua brand: ${hits.join(', ')}.`
        : 'Cach xung ho cua bai chua the hien ro brand voice.',
    };
  }

  private evaluateEmojiUsage(
    plainText: string,
    profile: BrandVoiceProfileLite,
  ): SimilarityMetric | null {
    if (typeof profile.emoji_usage?.enabled !== 'boolean') return null;

    const emojiCount = Array.from(plainText).filter((char) => /\p{Extended_Pictographic}/u.test(char)).length;
    if (profile.emoji_usage.enabled) {
      return {
        score: emojiCount > 0 ? 100 : 40,
        passed: emojiCount > 0,
        note: emojiCount > 0 ? `Da dung ${emojiCount} emoji.` : 'Brand cho phep emoji nhung bai hien tai khong dung.',
      };
    }

    return {
      score: emojiCount === 0 ? 100 : 20,
      passed: emojiCount === 0,
      note: emojiCount === 0 ? 'Khong dung emoji, dung voi profile.' : `Brand khong dung emoji nhung bai co ${emojiCount} emoji.`,
    };
  }

  private evaluateReferenceSimilarity(
    plainText: string,
    references: ReferenceArticleLite[],
  ): SimilarityMetric | null {
    if (!references.length) return null;

    const articleTerms = new Set(this.extractFrequentTerms(plainText));
    if (!articleTerms.size) return null;

    const referenceTerms = new Set(
      references.flatMap((reference) => this.extractFrequentTerms(reference.content)),
    );
    if (!referenceTerms.size) return null;

    const overlap = [...articleTerms].filter((term) => referenceTerms.has(term)).length;
    const ratio = overlap / Math.max(1, Math.min(articleTerms.size, 20));
    const score = Math.min(100, Math.round(ratio * 180));

    return {
      score,
      passed: score >= 55,
      note: `Do phu hop tu vung voi bai mau dat ${Math.round(ratio * 100)}%.`,
    };
  }

  private buildSuggestions(breakdown: Record<string, SimilarityMetric>): string[] {
    const suggestions: string[] = [];

    if ((breakdown.signature_phrases?.score ?? 100) < 60) {
      suggestions.push('Chen them 1-2 cum tu dac trung cua brand vao mo bai, chuyen doan va CTA.');
    }
    if ((breakdown.preferred_vocabulary?.score ?? 100) < 60) {
      suggestions.push('Tang mat do tu vung uu tien cua brand, nhat la o cac H2 chinh va ket bai.');
    }
    if ((breakdown.forbidden_phrases?.score ?? 100) < 80) {
      suggestions.push('Loai bo cac cum tu may moc hoac cum tu brand muon tranh.');
    }
    if ((breakdown.sentence_length?.score ?? 100) < 70) {
      suggestions.push('Chinh lai do dai cau de gan voi nhip cau cua bai mau.');
    }
    if ((breakdown.paragraph_rhythm?.score ?? 100) < 70) {
      suggestions.push('Canh lai so cau moi doan de bai doc giong nhip cua brand hon.');
    }
    if ((breakdown.addressing?.score ?? 100) < 50) {
      suggestions.push('Thong nhat cach xung ho voi doc gia va cach tu xung cua brand trong toan bai.');
    }

    return suggestions.length ? suggestions : ['Bai viet da bám khá sat brand voice tren cac tin hieu chinh.'];
  }

  private extractFrequentTerms(text: string): string[] {
    const tokens = this.normalize(text)
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !this.isStopWord(token));
    const counts = new Map<string, number>();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([token]) => token);
  }

  private isStopWord(token: string): boolean {
    return [
      'nhung',
      'trong',
      'nhung',
      'nhung',
      'cung',
      'theo',
      'duoc',
      'nguoi',
      'khi',
      'cho',
      'voi',
      'mot',
      'nhieu',
      'this',
      'that',
      'with',
      'from',
      'your',
      'have',
    ].includes(token);
  }

  private toPlainText(markdown: string): string {
    return markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]+`/g, ' ')
      .replace(/^#+\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[>*_~|-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private countWords(text: string): number {
    const normalized = this.normalize(text);
    return normalized ? normalized.split(/\s+/).length : 0;
  }

  private countSentences(text: string): number {
    return text
      .split(/[.!?]+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean).length;
  }
}
