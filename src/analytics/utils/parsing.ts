import * as XLSX from 'xlsx';
import { FundamentalMapping, Trade } from '../types/trade';
import { toDurationStr } from './time';

type ParseResult = {
  headers: string[];
  rows: Record<string, any>[];
};

export async function readExcel(file: File): Promise<ParseResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: null
  });
  const headers: string[] = XLSX.utils.sheet_to_json(sheet, {
    header: 1
  })[0] as string[];
  return { headers, rows };
}

const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)).getTime();

function excelSerialToDate(value: number): Date | undefined {
  if (Number.isFinite(value)) {
    const ms = EXCEL_EPOCH + value * 24 * 60 * 60 * 1000;
    return new Date(ms);
  }
  return undefined;
}

function parseDate(value: any): Date | undefined {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const excel = excelSerialToDate(value);
    if (excel && !isNaN(excel.getTime())) return excel;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

function parseNumber(value: any): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/,/g, ''));
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function toUtcParts(date: Date | undefined) {
  if (!date || isNaN(date.getTime())) {
    return {
      year: 0,
      month: 0,
      day: 0,
      hour: 0,
      timeBucket: 'NA',
      fiveMinuteBucket: 'NA'
    };
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const hourStr = hour.toString().padStart(2, '0');
  const minuteBucket = Math.floor(date.getUTCMinutes() / 5) * 5;
  const minuteStr = minuteBucket.toString().padStart(2, '0');
  return {
    year,
    month,
    day,
    hour,
    timeBucket: `${hourStr}:00`,
    fiveMinuteBucket: `${hourStr}:${minuteStr}`
  };
}

function normalizeTradeRow(
  row: Record<string, any>,
  mapping: FundamentalMapping,
  idx: number,
  warnings: string[]
): Trade | null {
  const startRaw = row[mapping.startTimeCol];
  const endRaw = row[mapping.endTimeCol];
  const pnlRaw = row[mapping.pnlCol];
  const symbolRaw = row[mapping.symbolCol];
  const actionRaw = row[mapping.actionCol];

  const start = parseDate(startRaw);
  const end = parseDate(endRaw);
  // Unclosed / missing end time → skip quietly (not an error)
  if (!end) return null;

  const pnl = parseNumber(pnlRaw) ?? 0;
  const symbol = symbolRaw ? String(symbolRaw) : '';
  const action = actionRaw ? String(actionRaw).toUpperCase() : '';

  const invalidReasons: string[] = [];
  if (!start) invalidReasons.push('invalid start time');
  if (!symbol) invalidReasons.push('missing symbol');

  const durationMs = start ? Math.max(0, end.getTime() - start.getTime()) : 0;
  const parts = toUtcParts(start);

  if (invalidReasons.length) {
    warnings.push(`Row ${idx + 2}: ${invalidReasons.join(', ')}`);
  }

  return {
    id: `${idx}`,
    raw: row,
    startTime: start ?? new Date(),
    endTime: end,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    timeBucket: parts.timeBucket,
    fiveMinuteBucket: parts.fiveMinuteBucket,
    pnlValue: pnl,
    symbol,
    action,
    durationMs,
    invalid: invalidReasons.length > 0,
    invalidReason: invalidReasons.join(', ') || undefined
  };
}

export function normalizeTrades(
  rows: Record<string, any>[],
  mapping: FundamentalMapping
): { trades: Trade[]; warnings: string[] } {
  const warnings: string[] = [];
  const trades: Trade[] = [];
  rows.forEach((row, idx) => {
    const trade = normalizeTradeRow(row, mapping, idx, warnings);
    if (trade) trades.push(trade);
  });
  return { trades, warnings };
}

export async function normalizeTradesAsync(
  rows: Record<string, any>[],
  mapping: FundamentalMapping,
  chunkSize = 1500
): Promise<{ trades: Trade[]; warnings: string[] }> {
  const warnings: string[] = [];
  const trades: Trade[] = [];
  for (let i = 0; i < rows.length; i++) {
    const trade = normalizeTradeRow(rows[i], mapping, i, warnings);
    if (trade) trades.push(trade);
    if (i > 0 && i % chunkSize === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return { trades, warnings };
}

export function loadMappingFromStorage(): FundamentalMapping | undefined {
  const raw = localStorage.getItem('talab_mapping');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as FundamentalMapping;
  } catch {
    return undefined;
  }
}

export function saveMappingToStorage(mapping: FundamentalMapping) {
  localStorage.setItem('talab_mapping', JSON.stringify(mapping));
}

export function loadFilterFieldsFromStorage(): string[] | undefined {
  const raw = localStorage.getItem('talab_filter_fields');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return undefined;
  }
}

export function saveFilterFieldsToStorage(fields: string[]) {
  localStorage.setItem('talab_filter_fields', JSON.stringify(fields));
}

export function summariseDuration(ms: number): string {
  return toDurationStr(ms);
}
