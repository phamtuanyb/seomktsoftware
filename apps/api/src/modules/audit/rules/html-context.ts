import * as cheerio from 'cheerio';
import type { AuditInput } from './base.rule';

/**
 * Parsed-once cheerio context for an audit run so each rule does not pay the
 * HTML parse cost again. AuditService caches one HtmlContext per evaluate()
 * call and threads it through @Injectable rule constructors that need it.
 *
 * Rules that only need plain text use the convenience strings on this object.
 */
export class HtmlContext {
  readonly $: cheerio.CheerioAPI;
  readonly text: string;
  readonly wordCount: number;

  constructor(input: AuditInput) {
    this.$ = cheerio.load(input.content || '');
    // Strip script + style for word counts.
    const $clone = cheerio.load(input.content || '');
    $clone('script, style').remove();
    this.text = $clone.root().text().replace(/\s+/g, ' ').trim();
    this.wordCount = this.text ? this.text.split(/\s+/).length : 0;
  }

  /** Cheap helper — first N words (used by intro-hook rule). */
  firstNWords(n: number): string {
    return this.text.split(/\s+/).slice(0, n).join(' ');
  }
}
