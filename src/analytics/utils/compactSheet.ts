import * as XLSX from 'xlsx';
import { columnsUsedForDisplay, guessMappingFromHeaders } from './mappingGuess';
import { isShownTradeRow } from './parsing';

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
