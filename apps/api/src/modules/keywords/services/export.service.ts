import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { KeywordRow } from './projects.service';

export type ExportFormat = 'csv' | 'excel';

export interface ExportPayload {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * TN1 acceptance: "Export CSV 500 keyword <5s" + spec endpoint
 * `/keywords/projects/:id/export?format=csv|excel`. CSV is built inline
 * (RFC 4180 compliant escaping); Excel uses ExcelJS so the user lands an
 * .xlsx file straight from the download link.
 */
@Injectable()
export class KeywordExportService {
  async export(
    projectName: string,
    rows: KeywordRow[],
    format: ExportFormat,
  ): Promise<ExportPayload> {
    const safeName = this.toFilename(projectName);
    if (format === 'excel') {
      const buffer = await this.toExcel(rows);
      return {
        filename: `${safeName}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      };
    }
    return {
      filename: `${safeName}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      buffer: this.toCsv(rows),
    };
  }

  private toCsv(rows: KeywordRow[]): Buffer {
    const header = [
      'keyword',
      'source',
      'volume',
      'keyword_difficulty',
      'cpc',
      'intent',
      'intent_confidence',
      'analyzed_at',
      'created_at',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          this.csvCell(r.keyword),
          this.csvCell(r.source ?? ''),
          r.volume ?? '',
          r.keyword_difficulty ?? '',
          r.cpc ?? '',
          this.csvCell(r.intent ?? ''),
          r.intent_confidence ?? '',
          r.analyzed_at ?? '',
          r.created_at,
        ].join(','),
      );
    }
    // UTF-8 BOM so Excel on Windows opens Vietnamese correctly.
    return Buffer.concat([Buffer.from('﻿', 'utf8'), Buffer.from(lines.join('\r\n'), 'utf8')]);
  }

  private csvCell(value: string): string {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  private async toExcel(rows: KeywordRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Keywords');
    sheet.columns = [
      { header: 'Keyword', key: 'keyword', width: 50 },
      { header: 'Source', key: 'source', width: 15 },
      { header: 'Volume', key: 'volume', width: 12 },
      { header: 'KD', key: 'keyword_difficulty', width: 8 },
      { header: 'CPC', key: 'cpc', width: 10 },
      { header: 'Intent', key: 'intent', width: 16 },
      { header: 'Intent confidence', key: 'intent_confidence', width: 18 },
      { header: 'Analyzed at', key: 'analyzed_at', width: 22 },
      { header: 'Created at', key: 'created_at', width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) sheet.addRow(r);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private toFilename(name: string): string {
    return (
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'keywords'
    );
  }
}
