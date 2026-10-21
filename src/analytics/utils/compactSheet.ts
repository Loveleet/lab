import * as XLSX from 'xlsx';
import { FundamentalMapping } from '../types/trade';
import { columnsUsedForDisplay, guessMappingFromHeaders } from './mappingGuess';
import { isShownTradeRow } from './parsing';

/** Names the page already recognizes, so a saved file opens without asking again. */
export const CANONICAL_MAPPING: FundamentalMapping = {
  startTimeCol: 'execute_time',
  endTimeCol: 'close_time',
  pnlCol: 'Profit Loss',
  symbolCol: 'symbol',
  actionCol: 'action'
};

/** True when this workbook was already slimmed and saved for analytics (re-open skips re-upload). */
export function isCanonicalAnalyticsHeaders(headers: string[]): boolean {
  const set = new Set(headers.map((h) => String(h).trim()));
  return Object.values(CANONICAL_MAPPING).every((col) => set.has(col));
}

export type CompactedSheet = {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
};

function cellForExcel(value: unknown): unknown {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return value ?? null;
}

/** Keep only rows and columns the analytics page displays. */
export function compactForAnalytics(headers: string[], rows: Record<string, any>[]): CompactedSheet | null {
  const mapping = guessMappingFromHeaders(headers);
  if (!mapping) return null;
  const keptHeaders = columnsUsedForDisplay(headers, mapping);
  const useHeaders = keptHeaders.length ? keptHeaders : headers;
  const keptRows = rows
    .filter((row) => isShownTradeRow(row, mapping))
    .map((row) => {
      const next: Record<string, any> = {};
      useHeaders.forEach((header) => {
        next[header] = cellForExcel(row[header]);
      });
      return next;
    });
  return { headers: useHeaders, rows: keptRows, totalRows: rows.length };
}

/** Keep the mapped columns and chosen filters, under stable names. */
export function compactWithMapping(
  rows: Record<string, any>[],
  mapping: FundamentalMapping,
  filterFields: string[]
): CompactedSheet & { mapping: FundamentalMapping } {
  const roleSources = new Set(Object.values(mapping));
  const extras = Array.from(new Set(filterFields.filter((field) => field && !roleSources.has(field))));
  const headers = [...Object.values(CANONICAL_MAPPING), ...extras];
  const keptRows = rows.filter((row) => isShownTradeRow(row, mapping)).map((row) => {
    const next: Record<string, any> = {
      [CANONICAL_MAPPING.startTimeCol]: cellForExcel(row[mapping.startTimeCol]),
      [CANONICAL_MAPPING.endTimeCol]: cellForExcel(row[mapping.endTimeCol]),
      [CANONICAL_MAPPING.pnlCol]: cellForExcel(row[mapping.pnlCol]),
      [CANONICAL_MAPPING.symbolCol]: cellForExcel(row[mapping.symbolCol]),
      [CANONICAL_MAPPING.actionCol]: cellForExcel(row[mapping.actionCol])
    };
    extras.forEach((field) => {
      next[field] = cellForExcel(row[field]);
    });
    return next;
  });
  return { headers, rows: keptRows, totalRows: rows.length, mapping: { ...CANONICAL_MAPPING } };
}

export function toExcelFile(fileName: string, headers: string[], rows: Record<string, any>[]): File {
  const sheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? null))
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const name = /\.xlsx$/i.test(fileName) ? fileName : fileName.replace(/\.xls$/i, '') + '.xlsx';
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}
