/* eslint-disable no-restricted-globals */
import {
  groupByDay,
  groupByMonth,
  groupBySymbol,
  groupByTimeBucket,
  groupByYear,
  groupByFiveMinuteBucket
} from '../utils/aggregation';
import { ActiveFilters, GroupStats, TimeSelection, Trade } from '../types/trade';

export type WorkerTrade = {
  id?: string;
  startTime: Date;
  endTime: Date;
  year: number;
  month: number;
  day: number;
  hour: number;
  timeBucket: string;
  fiveMinuteBucket: string;
  pnlValue: number;
  symbol: string;
  action: string;
  durationMs: number;
  raw: Record<string, string>;
};

const asTrades = (trades: WorkerTrade[]): Trade[] =>
  trades.map((t, idx) => ({
    ...t,
    id: t.id ?? String(idx),
    action: t.action
  }));

type WorkerFilters = Record<string, string[]>;

type StatsRequest = {
  type: 'stats';
  trades: WorkerTrade[];
  filters: WorkerFilters;
  timeSelection: TimeSelection;
};

type StatsResponse = {
  type: 'stats';
  year: GroupStats[];
  month: GroupStats[];
  day: GroupStats[];
  time: GroupStats[];
  minutes: GroupStats[];
  symbol: GroupStats[];
};

const toActiveFilters = (filters: WorkerFilters): ActiveFilters => {
  const result: ActiveFilters = {};
  Object.entries(filters).forEach(([k, arr]) => {
    result[k] = new Set(arr);
  });
  return result;
};

self.onmessage = (event: MessageEvent<StatsRequest>) => {
  try {
    const data = event.data;
    if (data.type === 'stats') {
      const activeFilters = toActiveFilters(data.filters);
      const timeSelection = data.timeSelection;

      const filtered = data.trades.filter((trade) => {
        for (const [field, values] of Object.entries(activeFilters)) {
          if (values.size === 0) continue;
          const asString =
            field === 'action'
              ? String(trade.action || '').toUpperCase()
              : trade.raw[field] === undefined || trade.raw[field] === null
              ? ''
              : String(trade.raw[field]);
          if (!values.has(asString)) return false;
        }
        return true;
      });

      const current = filtered.filter((trade) => {
        if (timeSelection.selectedYear && trade.year !== timeSelection.selectedYear) return false;
        if (timeSelection.selectedMonth && trade.month !== timeSelection.selectedMonth) return false;
        if (timeSelection.selectedDay && trade.day !== timeSelection.selectedDay) return false;
        if (timeSelection.selectedTimeBucket && trade.timeBucket !== timeSelection.selectedTimeBucket)
          return false;
        return true;
      });

      const filteredTrades = asTrades(filtered);
      const currentTrades = asTrades(current);

      const year = groupByYear(filteredTrades);
      const month =
        timeSelection.selectedYear !== undefined
          ? groupByMonth(filteredTrades, timeSelection.selectedYear)
          : [];
      const day =
        timeSelection.selectedYear !== undefined && timeSelection.selectedMonth !== undefined
          ? groupByDay(filteredTrades, timeSelection.selectedYear, timeSelection.selectedMonth)
          : [];
      const time =
        timeSelection.selectedYear !== undefined &&
        timeSelection.selectedMonth !== undefined &&
        timeSelection.selectedDay !== undefined
          ? groupByTimeBucket(
              filteredTrades,
              timeSelection.selectedYear,
              timeSelection.selectedMonth,
              timeSelection.selectedDay
            )
          : [];
      const symbol = groupBySymbol(currentTrades);
      const minutes =
        timeSelection.selectedYear !== undefined &&
        timeSelection.selectedMonth !== undefined &&
        timeSelection.selectedDay !== undefined &&
        timeSelection.selectedTimeBucket !== undefined
          ? groupByFiveMinuteBucket(
              filteredTrades,
              timeSelection.selectedYear,
              timeSelection.selectedMonth,
              timeSelection.selectedDay,
              Number(timeSelection.selectedTimeBucket.split(':')[0])
            )
          : [];

      const res: StatsResponse = { type: 'stats', year, month, day, time, minutes, symbol };
      (self as any).postMessage(res);
    }
  } catch (error: any) {
    (self as any).postMessage({ type: 'error', error: error?.message || 'Worker failed' });
  }
};
