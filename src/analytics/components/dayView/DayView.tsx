import type { FC } from 'react';
import { useMemo, useState } from 'react';
import type { Trade } from '../../types/trade';
import TradesTable from '../tradesTable/TradesTable';
import {
  avgPeakConcurrentDuringLocalHourAcrossDays,
  computeMaxConcurrentTrades,
  utcWeekdayIndexFromParts
} from '../../utils/aggregation';
import { toDurationStr } from '../../utils/time';
import { HelpMetric } from '../common/MetricField';

type Props = {
  trades: Trade[];
  nightMode: boolean;
};

type DayStat = {
  dayLabel: string;
  trades: Trade[];
  tradesCount: number;
  buyCount: number;
  sellCount: number;
  profitCount: number;
  lossCount: number;
  totalProfit: number;
  totalLoss: number;
  net: number;
  winRate: number;
  avgDurationStr: string;
  avgDuration: number;
  maxOpen: number;
};

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DayView: FC<Props> = ({ trades, nightMode }) => {
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<'day' | 'trades' | 'net' | 'win'>('day');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [hourSortKey, setHourSortKey] = useState<'time' | 'trades' | 'net' | 'win' | 'running'>('time');
  const [hourSortDir, setHourSortDir] = useState<'asc' | 'desc'>('asc');

  const years = useMemo(() => Array.from(new Set(trades.map((t) => t.year))).sort(), [trades]);
  const months = useMemo(() => Array.from(new Set(trades.map((t) => t.month))).sort((a, b) => a - b), [trades]);

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (selectedYears.size && !selectedYears.has(t.year)) return false;
      if (selectedMonths.size && !selectedMonths.has(t.month)) return false;
      return true;
    });
  }, [trades, selectedYears, selectedMonths]);

  const dayStats = useMemo<DayStat[]>(() => {
    const map = new Map<string, DayStat>();
    filteredTrades.forEach((t) => {
      const label = weekdays[utcWeekdayIndexFromParts(t.year, t.month, t.day)];
      const entry =
        map.get(label) ||
        {
          dayLabel: label,
          trades: [],
          tradesCount: 0,
          buyCount: 0,
          sellCount: 0,
          profitCount: 0,
          lossCount: 0,
          totalProfit: 0,
          totalLoss: 0,
          net: 0,
          winRate: 0,
          avgDuration: 0,
          avgDurationStr: '0m',
          maxOpen: 0
        };
      entry.trades.push(t);
      map.set(label, entry);
    });

    const stats: DayStat[] = Array.from(map.values()).map((item) => {
      const list = item.trades;
      const tradesCount = list.length;
      const buyCount = list.filter((t) => String(t.action).toUpperCase() === 'BUY').length;
      const sellCount = list.filter((t) => String(t.action).toUpperCase() === 'SELL').length;
      const net = list.reduce((acc, t) => acc + (t.pnlValue || 0), 0);
      const totalProfit = list.reduce((acc, t) => acc + Math.max(0, t.pnlValue || 0), 0);
      const totalLoss = list.reduce((acc, t) => acc + Math.min(0, t.pnlValue || 0), 0);
      const profitCount = list.filter((t) => t.pnlValue > 0).length;
      const lossCount = list.filter((t) => t.pnlValue < 0).length;
      const avgDuration = tradesCount > 0 ? list.reduce((acc, t) => acc + (t.durationMs || 0), 0) / tradesCount : 0;
      const winRate = tradesCount > 0 ? (profitCount / tradesCount) * 100 : 0;
      const maxOpen = tradesCount > 0 ? computeMaxConcurrentTrades(list) : 0;
      return {
        ...item,
        tradesCount,
        buyCount,
        sellCount,
        profitCount,
        lossCount,
        totalProfit,
        totalLoss,
        net,
        winRate,
        avgDuration,
        avgDurationStr: toDurationStr(avgDuration),
        maxOpen
      };
    });

    return stats.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'day') return dir * weekdays.indexOf(a.dayLabel) - dir * weekdays.indexOf(b.dayLabel);
      if (sortKey === 'trades') return dir * (a.tradesCount - b.tradesCount);
      if (sortKey === 'net') return dir * (a.net - b.net);
      if (sortKey === 'win') return dir * (a.winRate - b.winRate);
      return 0;
    });
  }, [filteredTrades, sortDir, sortKey]);

  const hourStats = useMemo(() => {
    if (!expandedDay) return [];
    const list = filteredTrades.filter((t) => {
      return weekdays[utcWeekdayIndexFromParts(t.year, t.month, t.day)] === expandedDay;
    });
    return Object.values(
      list.reduce<Record<string, { bucket: string; trades: Trade[] }>>((acc, t) => {
        const key = t.timeBucket || `${String(t.hour).padStart(2, '0')}:00`;
        if (!acc[key]) acc[key] = { bucket: key, trades: [] };
        acc[key].trades.push(t);
        return acc;
      }, {})
    );
  }, [expandedDay, filteredTrades]);

  const matchedTrades = useMemo(() => {
    if (!dayStats.length) return [];
    const daysSet = new Set(dayStats.map((d) => d.dayLabel));
    return filteredTrades.filter((t) => {
      return daysSet.has(weekdays[utcWeekdayIndexFromParts(t.year, t.month, t.day)]);
    });
  }, [dayStats, filteredTrades]);

  return (
    <section className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm font-semibold">Daywise Analysis</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Sort:</span>
          <select
            className={
              nightMode
                ? 'bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded px-2 py-1'
                : 'bg-white border border-slate-200 text-xs rounded px-2 py-1'
            }
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          >
            <option value="day">Day</option>
            <option value="trades">Trades</option>
            <option value="net">Net P/L</option>
            <option value="win">Win rate</option>
          </select>
          <button
            className={
              nightMode
                ? 'px-3 py-2 rounded-full border border-slate-700 bg-slate-800 text-slate-100 text-xs font-semibold'
                : 'px-3 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-semibold'
            }
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            {sortDir === 'asc' ? 'Asc' : 'Desc'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="text-xs font-semibold">Select years</div>
        {years.map((y) => (
          <button
            key={y}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              nightMode
                ? selectedYears.has(y)
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-700 bg-slate-800 text-slate-100'
                : selectedYears.has(y)
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
            onClick={() =>
              setSelectedYears((prev) => {
                const next = new Set(prev);
                if (next.has(y)) next.delete(y);
                else next.add(y);
                return next;
              })
            }
          >
            {y}
          </button>
        ))}
        <button
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            nightMode ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-700'
          }`}
          onClick={() => setSelectedYears(new Set())}
        >
          All years
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="text-xs font-semibold">Select months</div>
        {months.map((m) => (
          <button
            key={m}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              nightMode
                ? selectedMonths.has(m)
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-700 bg-slate-800 text-slate-100'
                : selectedMonths.has(m)
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
            onClick={() =>
              setSelectedMonths((prev) => {
                const next = new Set(prev);
                if (next.has(m)) next.delete(m);
                else next.add(m);
                return next;
              })
            }
          >
            {m.toString().padStart(2, '0')}
          </button>
        ))}
        <button
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            nightMode ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-700'
          }`}
          onClick={() => setSelectedMonths(new Set())}
        >
          All months
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {dayStats.map((d) => (
          <div
            key={d.dayLabel}
            className={`card p-4 border transition-transform hover:-translate-y-0.5 ${
              nightMode ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-card' : 'bg-white border-slate-200 shadow-card'
            }`}
            onClick={() => setExpandedDay((prev) => (prev === d.dayLabel ? null : d.dayLabel))}
          >
            <div className="text-xs font-semibold text-indigo-500 uppercase">Day</div>
            <div className="text-lg font-bold mt-1">{d.dayLabel}</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <HelpMetric label="Trades" helpId="trades" value={d.tradesCount.toLocaleString()} nightMode={nightMode} />
                <HelpMetric
                  label="Profit / Loss count"
                  helpId="profitLossCount"
                  value={`${d.profitCount.toLocaleString()} / ${d.lossCount.toLocaleString()}`}
                  nightMode={nightMode}
                />
                <HelpMetric
                  label="Profit / Loss amount"
                  helpId="profitLossAmount"
                  value={
                    <>
                      <span className="text-emerald-500">{d.totalProfit.toFixed(2)}</span> /{' '}
                      <span className="text-rose-500">{d.totalLoss.toFixed(2)}</span>
                    </>
                  }
                  nightMode={nightMode}
                />
                <HelpMetric label="Avg duration" helpId="avgDur" value={d.avgDurationStr} nightMode={nightMode} />
              </div>
              <div className="space-y-2">
                <HelpMetric
                  label="Buys / Sells"
                  helpId="buysSells"
                  value={`${d.buyCount.toLocaleString()} / ${d.sellCount.toLocaleString()}`}
                  nightMode={nightMode}
                />
                <HelpMetric
                  label="Net P/L"
                  helpId="netPnl"
                  value={
                    <span className={`font-extrabold text-lg ${d.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {d.net.toFixed(2)}
                    </span>
                  }
                  nightMode={nightMode}
                />
                <HelpMetric label="Win rate" helpId="winRate" value={`${d.winRate.toFixed(1)}%`} nightMode={nightMode} />
                <HelpMetric label="Max open" helpId="maxOpen" value={d.maxOpen} nightMode={nightMode} />
              </div>
            </div>
          </div>
        ))}
        {!dayStats.length && (
          <div className={`text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>
            No trades match the current selection.
          </div>
        )}
      </div>

      {expandedDay && hourStats.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-sm font-semibold">Hour buckets for {expandedDay}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Sort:</span>
              <select
                className={
                  nightMode
                    ? 'bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded px-2 py-1'
                    : 'bg-white border border-slate-200 text-xs rounded px-2 py-1'
                }
                value={hourSortKey}
                onChange={(e) => setHourSortKey(e.target.value as typeof hourSortKey)}
              >
                <option value="time">Time</option>
                <option value="trades">Trades</option>
                <option value="net">Net P/L</option>
                <option value="win">Win rate</option>
                <option value="running">Running (avg peak)</option>
              </select>
              <button
                className={
                  nightMode
                    ? 'px-3 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-100 text-xs font-semibold'
                    : 'px-3 py-1 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-semibold'
                }
                onClick={() => setHourSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              >
                {hourSortDir === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {hourStats
              .map((bucket) => {
                const list = bucket.trades;
                const tradesCount = list.length;
                const net = list.reduce((acc, t) => acc + (t.pnlValue || 0), 0);
                const profitCount = list.filter((t) => t.pnlValue > 0).length;
                const lossCount = list.filter((t) => t.pnlValue < 0).length;
                const winRate = tradesCount > 0 ? (profitCount / tradesCount) * 100 : 0;
                const avgDuration =
                  tradesCount > 0 ? list.reduce((acc, t) => acc + (t.durationMs || 0), 0) / tradesCount : 0;
                const hourNum = Number(bucket.bucket.split(':')[0]);
                const weekdayIdx =
                  expandedDay !== null ? weekdays.indexOf(expandedDay) : -1;
                const runningAvgPeak =
                  weekdayIdx >= 0 && Number.isFinite(hourNum)
                    ? avgPeakConcurrentDuringLocalHourAcrossDays(filteredTrades, weekdayIdx, hourNum)
                    : 0;
                return {
                  bucket: bucket.bucket,
                  runningAvgPeak,
                  tradesCount,
                  net,
                  profitCount,
                  lossCount,
                  winRate,
                  avgDuration,
                  list
                };
              })
              .sort((a, b) => {
                const dir = hourSortDir === 'asc' ? 1 : -1;
                if (hourSortKey === 'time') return dir * a.bucket.localeCompare(b.bucket);
                if (hourSortKey === 'trades') return dir * (a.tradesCount - b.tradesCount);
                if (hourSortKey === 'net') return dir * (a.net - b.net);
                if (hourSortKey === 'win') return dir * (a.winRate - b.winRate);
                if (hourSortKey === 'running') return dir * (a.runningAvgPeak - b.runningAvgPeak);
                return 0;
              })
              .map((row) => (
                <div
                  key={row.bucket}
                  className={`card p-3 border ${
                    nightMode ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-card' : 'bg-white border-slate-200 shadow-card'
                  }`}
                >
                  <div className="text-xs font-semibold uppercase text-indigo-500">{row.bucket}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <HelpMetric label="Trades" helpId="trades" value={row.tradesCount.toLocaleString()} nightMode={nightMode} />
                    <HelpMetric
                      label="Running (avg peak)"
                      helpId="runningAvgPeak"
                      value={row.runningAvgPeak.toFixed(2)}
                      nightMode={nightMode}
                    />
                    <HelpMetric
                      label="Profit / Loss count"
                      helpId="profitLossCount"
                      value={`${row.profitCount} / ${row.lossCount}`}
                      nightMode={nightMode}
                    />
                    <HelpMetric
                      label="Profit / Loss amount"
                      helpId="profitLossAmount"
                      value={
                        <>
                          <span className="text-emerald-500">
                            {row.list.reduce((acc, t) => acc + Math.max(0, t.pnlValue || 0), 0).toFixed(2)}
                          </span>{' '}
                          /{' '}
                          <span className="text-rose-500">
                            {row.list.reduce((acc, t) => acc + Math.min(0, t.pnlValue || 0), 0).toFixed(2)}
                          </span>
                        </>
                      }
                      nightMode={nightMode}
                    />
                    <HelpMetric
                      label="Net P/L"
                      helpId="netPnl"
                      value={
                        <span className={`font-extrabold ${row.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {row.net.toFixed(2)}
                        </span>
                      }
                      nightMode={nightMode}
                    />
                    <HelpMetric label="Win rate" helpId="winRate" value={`${row.winRate.toFixed(1)}%`} nightMode={nightMode} />
                    <HelpMetric label="Avg duration" helpId="avgDur" value={toDurationStr(row.avgDuration)} nightMode={nightMode} />
                  </div>
                  <p
                    className={`mt-2 text-[10px] leading-snug ${nightMode ? 'text-slate-500' : 'text-slate-500'}`}
                    title="UTC calendar days: peak concurrent during this hour includes trades still open from the previous day. Trades / P/L = trades whose start falls in this hour only."
                  >
                    Running uses UTC day boundaries (matches timestamps). Trades / P/L = start in this hour only.
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {matchedTrades.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Trades</div>
            <div className={`text-xs ${nightMode ? 'text-slate-300' : 'text-slate-500'}`}>
              Showing {matchedTrades.length.toLocaleString()} rows matching selected days
            </div>
          </div>
          <TradesTable trades={matchedTrades} nightMode={nightMode} />
        </div>
      )}
    </section>
  );
};

export default DayView;
