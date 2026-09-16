import { FilterFieldConfig, FundamentalMapping, Trade } from '../types/trade';

const RUNNING_TYPES = new Set(['running', 'hedge_hold', 'assigned', 'assign', 'back_close']);

export const LIVE_MAPPING: FundamentalMapping = {
  startTimeCol: 'operator_trade_time',
  endTimeCol: 'operator_close_time',
  pnlCol: 'pl_after_comm',
  symbolCol: 'pair',
  actionCol: 'action'
};

export const LIVE_FILTER_FIELDS = ['machineid', 'interval', 'signalfrom', 'type', 'pair', 'action'];

function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

function pickDate(...values: unknown[]): Date | undefined {
  for (const value of values) {
    const parsed = parseDate(value);
    if (parsed) return parsed;
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

export function isRunningLabTrade(row: Record<string, any>): boolean {
  return RUNNING_TYPES.has(String(row?.type ?? '').trim().toLowerCase());
}

export function mapLabTradesToAnalytics(rows: Record<string, any>[]): {
  trades: Trade[];
  warnings: string[];
} {
  const now = new Date();
  const warnings: string[] = [];
  const trades: Trade[] = [];

  rows.forEach((row, idx) => {
    const running = isRunningLabTrade(row);
    const start = pickDate(
      row.operator_trade_time,
      row.Operator_trade_time,
      row.fetcher_trade_time,
      row.candel_time,
      row.candle_time,
      row.created_at
    );
    const end =
      pickDate(row.operator_close_time, row.Operator_close_time, row.close_time, row.Close_time) ||
      (running ? now : undefined);

    if (!start) {
      warnings.push(`Row ${idx + 1}: missing execute time`);
      return;
    }
    if (!end) return;

    const pnlRaw = row.pl_after_comm ?? row.Pl_after_comm ?? row.unrealized_profit;
    const pnl = Number.parseFloat(String(pnlRaw ?? 0));
    const symbol = String(row.pair ?? row.Pair ?? row.symbol ?? '');
    const action = String(row.action ?? row.Action ?? '').toUpperCase();
    const parts = toUtcParts(start);

    trades.push({
      id: String(row.unique_id ?? row.Unique_ID ?? idx),
      raw: row,
      startTime: start,
      endTime: end,
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      timeBucket: parts.timeBucket,
      fiveMinuteBucket: parts.fiveMinuteBucket,
      pnlValue: Number.isFinite(pnl) ? pnl : 0,
      symbol,
      action,
      durationMs: Math.max(0, end.getTime() - start.getTime()),
      invalid: !symbol,
      invalidReason: !symbol ? 'missing symbol' : undefined
    });
  });

  return { trades, warnings };
}

export function liveFilterConfigs(): FilterFieldConfig[] {
  return LIVE_FILTER_FIELDS.map((fieldName) => ({ fieldName, displayName: fieldName }));
}

export function liveHeadersFromRows(rows: Record<string, any>[]): string[] {
  const keys = new Set<string>();
  rows.slice(0, 50).forEach((row) => {
    Object.keys(row || {}).forEach((key) => keys.add(key));
  });
  return Array.from(keys);
}
