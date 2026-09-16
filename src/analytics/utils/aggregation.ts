import { ActiveFilters, GroupStats, TimeSelection, Trade } from '../types/trade';
import { toDurationStr } from './time';

export const ACTION_FILTER_FIELD = 'action';

/** Value used for action filter matching (normalized uppercase). */
export function getTradeFilterValue(trade: Trade, field: string): string {
  if (field === ACTION_FILTER_FIELD) {
    return String(trade.action || '').toUpperCase();
  }
  const rawValue = trade.raw[field];
  return rawValue === undefined || rawValue === null ? '' : String(rawValue);
}

export type ActionFilterMode = 'both' | 'BUY' | 'SELL';
export type TimeGroupingBasis = 'opening' | 'closing';

export type UtcTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  timeBucket: string;
  fiveMinuteBucket: string;
};

function toDateMs(value: any): number | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function utcPartsFromDate(value: any): UtcTimeParts {
  const ms = toDateMs(value);
  if (ms === null) {
    return { year: 0, month: 0, day: 0, hour: 0, timeBucket: 'NA', fiveMinuteBucket: 'NA' };
  }
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const hourStr = hour.toString().padStart(2, '0');
  const minuteStr = (Math.floor(date.getUTCMinutes() / 5) * 5).toString().padStart(2, '0');
  return {
    year,
    month,
    day,
    hour,
    timeBucket: `${hourStr}:00`,
    fiveMinuteBucket: `${hourStr}:${minuteStr}`
  };
}

export function tradePartsForBasis(trade: Trade, basis: TimeGroupingBasis): UtcTimeParts {
  return utcPartsFromDate(basis === 'closing' ? trade.endTime : trade.startTime);
}

function countEndpointInWindow(
  trades: Trade[],
  which: 'start' | 'end',
  windowStart: number,
  windowEnd: number
): number {
  let n = 0;
  for (const t of trades) {
    const ms = toDateMs(which === 'start' ? t.startTime : t.endTime);
    if (ms !== null && ms >= windowStart && ms < windowEnd) n += 1;
  }
  return n;
}

function attachPeriodActivity(
  stats: GroupStats,
  allTrades: Trade[],
  windowStart: number,
  windowEnd: number
): GroupStats {
  stats.openCount = countEndpointInWindow(allTrades, 'start', windowStart, windowEnd);
  stats.closeCount = countEndpointInWindow(allTrades, 'end', windowStart, windowEnd);
  stats.maxRunning = maxConcurrentDuringWindow(allTrades, windowStart, windowEnd);
  return stats;
}

export function getActionFilterMode(activeFilters: ActiveFilters): ActionFilterMode {
  const set = activeFilters[ACTION_FILTER_FIELD];
  if (!set || set.size === 0) return 'both';
  const hasBuy = set.has('BUY');
  const hasSell = set.has('SELL');
  if (hasBuy && !hasSell) return 'BUY';
  if (hasSell && !hasBuy) return 'SELL';
  return 'both';
}

export function applyFilters(
  trades: Trade[],
  activeFilters: ActiveFilters,
  timeSelection: TimeSelection,
  basis: TimeGroupingBasis = 'opening'
): Trade[] {
  return trades.filter((trade) => {
    if (trade.invalid) return false;
    for (const [field, values] of Object.entries(activeFilters)) {
      if (values.size === 0) continue;
      const asString = getTradeFilterValue(trade, field);
      if (!values.has(asString)) return false;
    }

    const parts = tradePartsForBasis(trade, basis);
    if (timeSelection.selectedYear && parts.year !== timeSelection.selectedYear) return false;
    if (timeSelection.selectedMonth && parts.month !== timeSelection.selectedMonth) return false;
    if (timeSelection.selectedDay && parts.day !== timeSelection.selectedDay) return false;
    if (timeSelection.selectedTimeBucket && parts.timeBucket !== timeSelection.selectedTimeBucket)
      return false;
    if (timeSelection.selectedMinuteBucket && parts.fiveMinuteBucket !== timeSelection.selectedMinuteBucket)
      return false;
    return true;
  });
}

function calcStats(trades: Trade[], key: string, includeConcurrency?: boolean): GroupStats {
  const tradesCount = trades.length;
  const buyTrades = trades.filter((t) => String(t.action).toUpperCase() === 'BUY');
  const sellTrades = trades.filter((t) => String(t.action).toUpperCase() === 'SELL');
  const buyCount = buyTrades.length;
  const sellCount = sellTrades.length;
  const buyPnl = buyTrades.reduce((acc, t) => acc + (t.pnlValue || 0), 0);
  const sellPnl = sellTrades.reduce((acc, t) => acc + (t.pnlValue || 0), 0);
  const netPnl = trades.reduce((acc, t) => acc + (t.pnlValue || 0), 0);
  const totalProfit = trades.reduce((acc, t) => acc + Math.max(0, t.pnlValue || 0), 0);
  const totalLoss = trades.reduce((acc, t) => acc + Math.min(0, t.pnlValue || 0), 0);
  const profitCount = trades.filter((t) => t.pnlValue > 0).length;
  const lossCount = trades.filter((t) => t.pnlValue < 0).length;
  const avgDurationMs =
    tradesCount > 0 ? trades.reduce((acc, t) => acc + (t.durationMs || 0), 0) / tradesCount : 0;
  // dollar-weighted win percentage: profit / (profit + |loss|)
  const totalDollars = totalProfit + Math.abs(totalLoss);
  const winRate = totalDollars > 0 ? (totalProfit / totalDollars) * 100 : 0;

  const base: GroupStats = {
    key,
    tradesCount,
    buyCount,
    sellCount,
    buyPnl,
    sellPnl,
    profitCount,
    lossCount,
    totalProfit,
    totalLoss,
    netPnl,
    avgPnlPerTrade: tradesCount > 0 ? netPnl / tradesCount : 0,
    avgDurationMs,
    avgDurationStr: toDurationStr(avgDurationMs),
    winRate,
    profitLossRatio: totalLoss !== 0 ? totalProfit / Math.abs(totalLoss) : undefined
  };

  if (includeConcurrency) {
    base.maxConcurrentTrades = computeMaxConcurrentTrades(trades);
    base.avgConcurrentTrades = computeAvgConcurrentTrades(trades);
  }

  return base;
}

/** Add running P/L total in chronological order (each row includes all previous rows in the list). */
function applyPlSoFar(stats: GroupStats[]): GroupStats[] {
  let running = 0;
  return stats.map((s) => {
    running += s.netPnl;
    return { ...s, plSoFar: running };
  });
}

export function groupByYear(trades: Trade[], basis: TimeGroupingBasis = 'opening'): GroupStats[] {
  const grouped = new Map<number, Trade[]>();
  trades.forEach((t) => {
    const year = tradePartsForBasis(t, basis).year;
    grouped.set(year, [...(grouped.get(year) || []), t]);
  });
  return Array.from(grouped.entries())
    .map(([year, list]) => {
      const stats = calcStats(list, String(year), true);
      stats.hierarchicalAvgConcurrentTrades = hierarchicalAvgConcurrentFromTradesByMonthRollup(list);
      return attachPeriodActivity(stats, trades, Date.UTC(year, 0, 1), Date.UTC(year + 1, 0, 1));
    })
    .sort((a, b) => Number(b.key) - Number(a.key));
}

export function groupByMonth(
  trades: Trade[],
  year: number,
  basis: TimeGroupingBasis = 'opening'
): GroupStats[] {
  const grouped = new Map<number, Trade[]>();
  trades.forEach((t) => {
    const parts = tradePartsForBasis(t, basis);
    if (parts.year !== year) return;
    grouped.set(parts.month, [...(grouped.get(parts.month) || []), t]);
  });
  return applyPlSoFar(
    Array.from(grouped.entries())
      .map(([month, list]) => {
        const stats = calcStats(list, `${year}-${month.toString().padStart(2, '0')}`, true);
        stats.hierarchicalAvgConcurrentTrades = hierarchicalAvgConcurrentFromTradesByDay(list);
        const daysWithTrades = new Set(list.map((t) => tradePartsForBasis(t, basis).day)).size;
        stats.daysWithTrades = daysWithTrades || undefined;
        stats.avgTradesPerActiveDay =
          daysWithTrades > 0 ? Number((stats.tradesCount / daysWithTrades).toFixed(2)) : undefined;
        return attachPeriodActivity(
          stats,
          trades,
          Date.UTC(year, month - 1, 1),
          Date.UTC(year, month, 1)
        );
      })
      .sort((a, b) => Number(a.key.split('-')[1]) - Number(b.key.split('-')[1]))
  );
}

export function groupByDay(
  trades: Trade[],
  year: number,
  month: number,
  basis: TimeGroupingBasis = 'opening'
): GroupStats[] {
  const grouped = new Map<number, Trade[]>();
  trades.forEach((t) => {
    const parts = tradePartsForBasis(t, basis);
    if (parts.year !== year || parts.month !== month) return;
    grouped.set(parts.day, [...(grouped.get(parts.day) || []), t]);
  });
  return applyPlSoFar(
    Array.from(grouped.entries())
      .map(([day, list]) => {
        const stats = calcStats(
          list,
          `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
          true
        );
        stats.hierarchicalAvgConcurrentTrades = stats.avgConcurrentTrades ?? 0;
        const ws = Date.UTC(year, month - 1, day);
        return attachPeriodActivity(stats, trades, ws, ws + 86400000);
      })
      .sort((a, b) => Number(a.key.split('-')[2]) - Number(b.key.split('-')[2]))
  );
}

export function groupByTimeBucket(
  trades: Trade[],
  year: number,
  month: number,
  day: number,
  basis: TimeGroupingBasis = 'opening'
): GroupStats[] {
  const grouped = new Map<string, Trade[]>();
  trades.forEach((t) => {
    const parts = tradePartsForBasis(t, basis);
    if (parts.year !== year || parts.month !== month || parts.day !== day) return;
    grouped.set(parts.timeBucket, [...(grouped.get(parts.timeBucket) || []), t]);
  });
  return applyPlSoFar(
    Array.from(grouped.entries())
      .map(([bucket, list]) => {
        const stats = calcStats(list, bucket, false);
        const hour = Number(bucket.split(':')[0]);
        if (Number.isFinite(hour)) {
          const ws = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
          const we = ws + 60 * 60 * 1000;
          stats.hourPeakConcurrent = maxConcurrentDuringWindow(trades, ws, we);
          attachPeriodActivity(stats, trades, ws, we);
        }
        return stats;
      })
      .sort((a, b) => a.key.localeCompare(b.key))
  );
}

export function groupByFiveMinuteBucket(
  trades: Trade[],
  year: number,
  month: number,
  day: number,
  hour: number,
  basis: TimeGroupingBasis = 'opening'
): GroupStats[] {
  const grouped = new Map<string, Trade[]>();
  trades.forEach((t) => {
    const parts = tradePartsForBasis(t, basis);
    if (parts.year !== year || parts.month !== month || parts.day !== day || parts.hour !== hour) return;
    grouped.set(parts.fiveMinuteBucket, [...(grouped.get(parts.fiveMinuteBucket) || []), t]);
  });
  return Array.from(grouped.entries())
    .map(([bucket, list]) => {
      const stats = calcStats(list, bucket, false);
      const minute = Number(bucket.split(':')[1]);
      if (Number.isFinite(minute)) {
        const ws = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
        attachPeriodActivity(stats, trades, ws, ws + 5 * 60 * 1000);
      }
      return stats;
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function groupBySymbol(trades: Trade[]): GroupStats[] {
  const grouped = new Map<string, Trade[]>();
  trades.forEach((t) => grouped.set(t.symbol, [...(grouped.get(t.symbol) || []), t]));
  return Array.from(grouped.entries())
    .map(([symbol, list]) => calcStats(list, symbol, true))
    .sort((a, b) => b.tradesCount - a.tradesCount);
}

function tradeIntervalMs(t: Trade): { start: number; end: number } | null {
  const toMs = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return value.getTime();
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  };
  const start = toMs(t.startTime);
  const end = toMs(t.endTime);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

/** Peak concurrent trades at any instant inside [windowStart, windowEnd) (intervals clipped to the window). */
export function maxConcurrentDuringWindow(trades: Trade[], windowStart: number, windowEnd: number): number {
  const events: { time: number; delta: number }[] = [];
  for (const t of trades) {
    const b = tradeIntervalMs(t);
    if (!b) continue;
    const s = Math.max(b.start, windowStart);
    const e = Math.min(b.end, windowEnd);
    if (e <= s) continue;
    events.push({ time: s, delta: 1 });
    events.push({ time: e, delta: -1 });
  }
  if (!events.length) return 0;
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let open = 0;
  let max = 0;
  for (const ev of events) {
    open += ev.delta;
    if (open > max) max = open;
  }
  return max;
}

/** UTC weekday 0=Sun … 6=Sat for trade row calendar (y,m,d) — matches parsing toUtcParts. */
export function utcWeekdayIndexFromParts(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)).getUTCDay();
}

function utcCalendarDayKeyFromMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

/** Add trade to every UTC calendar day its [start,end) intersects (for overlap-based day grouping). */
function addTradeToOverlappingUtcCalendarDays(map: Map<string, Trade[]>, t: Trade) {
  const b = tradeIntervalMs(t);
  if (!b) return;
  let dayStart = Date.UTC(
    new Date(b.start).getUTCFullYear(),
    new Date(b.start).getUTCMonth(),
    new Date(b.start).getUTCDate(),
    0,
    0,
    0,
    0
  );
  const endMs = b.end;
  while (dayStart < endMs) {
    const k = utcCalendarDayKeyFromMs(dayStart);
    const prev = map.get(k) || [];
    if (!prev.some((x) => x.id === t.id)) map.set(k, [...prev, t]);
    dayStart += 86400000;
  }
}

/**
 * For a weekday (0=Sun … 6=Sat) and UTC clock hour (0–23): on each UTC calendar day with that weekday,
 * take the peak concurrent count during that hour (including trades that started on earlier days),
 * then return the mean across those days (only days with at least one trade overlapping that hour).
 */
export function avgPeakConcurrentDuringLocalHourAcrossDays(
  trades: Trade[],
  weekdayIndex: number,
  hour: number
): number {
  const byDay = new Map<string, Trade[]>();
  trades.forEach((t) => addTradeToOverlappingUtcCalendarDays(byDay, t));
  const peaks: number[] = [];
  byDay.forEach((dayTrades, key) => {
    const [y, mo, d] = key.split('-').map(Number);
    if (utcWeekdayIndexFromParts(y, mo, d) !== weekdayIndex) return;
    const ws = Date.UTC(y, mo - 1, d, hour, 0, 0, 0);
    const we = ws + 60 * 60 * 1000;
    const anyOverlap = dayTrades.some((t) => {
      const b = tradeIntervalMs(t);
      return b && b.start < we && b.end > ws;
    });
    if (!anyOverlap) return;
    peaks.push(maxConcurrentDuringWindow(dayTrades, ws, we));
  });
  return peaks.length ? peaks.reduce((a, b) => a + b, 0) / peaks.length : 0;
}

export function computeMaxConcurrentTrades(trades: Trade[]): number {
  const events: { time: number; delta: number }[] = [];
  trades.forEach((t) => {
    const b = tradeIntervalMs(t);
    if (!b) return;
    events.push({ time: b.start, delta: 1 });
    events.push({ time: b.end, delta: -1 });
  });
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let open = 0;
  let max = 0;
  for (const e of events) {
    open += e.delta;
    if (open > max) max = open;
  }
  return max;
}

export function computeAvgConcurrentTrades(trades: Trade[]): number {
  const toMs = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return value.getTime();
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  };
  const events: { time: number; delta: number }[] = [];
  trades.forEach((t) => {
    const start = toMs(t.startTime);
    const end = toMs(t.endTime);
    if (start === null || end === null || end < start) return;
    events.push({ time: start, delta: 1 });
    events.push({ time: end, delta: -1 });
  });
  if (!events.length) return 0;
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let open = 0;
  let area = 0;
  for (let i = 0; i < events.length - 1; i++) {
    open += events[i].delta;
    const dt = events[i + 1].time - events[i].time;
    if (dt > 0) area += open * dt;
  }
  const totalTime = events[events.length - 1].time - events[0].time;
  return totalTime > 0 ? area / totalTime : 0;
}

/** Average of each calendar day's time-weighted avg concurrent count (only days that have trades). */
export function hierarchicalAvgConcurrentFromTradesByDay(trades: Trade[]): number {
  if (!trades.length) return 0;
  const byDay = new Map<string, Trade[]>();
  trades.forEach((t) => {
    const k = `${t.year}-${t.month}-${t.day}`;
    byDay.set(k, [...(byDay.get(k) || []), t]);
  });
  const dailyAvgs: number[] = [];
  byDay.forEach((list) => {
    dailyAvgs.push(computeAvgConcurrentTrades(list));
  });
  return dailyAvgs.length ? dailyAvgs.reduce((a, b) => a + b, 0) / dailyAvgs.length : 0;
}

/** For each month with trades, take mean-of-daily avgs; then average those monthly values (for a year bucket). */
export function hierarchicalAvgConcurrentFromTradesByMonthRollup(trades: Trade[]): number {
  if (!trades.length) return 0;
  const byMonth = new Map<string, Trade[]>();
  trades.forEach((t) => {
    const k = `${t.year}-${t.month}`;
    byMonth.set(k, [...(byMonth.get(k) || []), t]);
  });
  const monthVals: number[] = [];
  byMonth.forEach((list) => {
    monthVals.push(hierarchicalAvgConcurrentFromTradesByDay(list));
  });
  return monthVals.length ? monthVals.reduce((a, b) => a + b, 0) / monthVals.length : 0;
}
