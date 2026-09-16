import type { FC } from 'react';
import type { Trade } from '../../types/trade';
import type { HolidayStat } from './HolidayView';
import TradesTable from '../tradesTable/TradesTable';
import { computeMaxConcurrentTrades } from '../../utils/aggregation';
import { toDurationStr } from '../../utils/time';
import { HelpMetric } from '../common/MetricField';

type ExpandedProps = {
  date: string;
  stats?: HolidayStat;
  nightMode: boolean;
};

type TimeStat = {
  bucket: string;
  tradesCount: number;
  net: number;
  trades: Trade[];
};

const ExpandedHolidayDetails: FC<ExpandedProps> = ({ date, stats, nightMode }) => {
  if (!stats) return null;

  const trades = stats.trades || [];
  const label = stats.baseDate || date;

  const timeStats: TimeStat[] = Object.values(
    trades.reduce<Record<string, TimeStat>>((acc, t) => {
      const key = t.timeBucket || `${String(t.hour).padStart(2, '0')}:00`;
      if (!acc[key]) acc[key] = { bucket: key, tradesCount: 0, net: 0, trades: [] };
      acc[key].tradesCount += 1;
      acc[key].net += t.pnlValue || 0;
      acc[key].trades.push(t);
      return acc;
    }, {})
  ).sort((a, b) => a.bucket.localeCompare(b.bucket));

  return (
    <div className={`mt-6 border rounded-lg p-4 ${nightMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">Details for {label}</div>
          <div className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {stats.holidays?.map((h) => `${h.names.join(', ')} (${h.country})`).join(' · ')}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-semibold">Hour / time buckets</div>
          <select
            className={
              nightMode
                ? 'bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded px-2 py-1'
                : 'bg-white border border-slate-200 text-xs rounded px-2 py-1'
            }
            value="time"
            onChange={() => {}}
          >
            <option>Sorted by time</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {timeStats.map((t) => {
            const profitCount = t.trades.filter((tr) => tr.pnlValue > 0).length;
            const lossCount = t.trades.filter((tr) => tr.pnlValue < 0).length;
            const totalProfit = t.trades.reduce((acc, tr) => acc + Math.max(0, tr.pnlValue || 0), 0);
            const totalLoss = t.trades.reduce((acc, tr) => acc + Math.min(0, tr.pnlValue || 0), 0);
            const avgDuration =
              t.tradesCount > 0
                ? t.trades.reduce((acc, tr) => acc + (tr.durationMs || 0), 0) / t.tradesCount
                : 0;
            const winRate = t.tradesCount > 0 ? (profitCount / t.tradesCount) * 100 : 0;
            const maxOpen = computeMaxConcurrentTrades(t.trades);
            return (
              <div
                key={t.bucket}
                className={`card p-3 border ${
                  nightMode ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-card' : 'bg-white border-slate-200 shadow-card'
                }`}
              >
                <div className="text-xs font-semibold uppercase text-indigo-500">{t.bucket}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <HelpMetric label="Trades" helpId="trades" value={t.tradesCount.toLocaleString()} nightMode={nightMode} />
                  <HelpMetric label="Profit / Loss count" helpId="profitLossCount" value={`${profitCount} / ${lossCount}`} nightMode={nightMode} />
                  <HelpMetric
                    label="Profit / Loss amount"
                    helpId="profitLossAmount"
                    value={
                      <>
                        <span className="text-emerald-500">{totalProfit.toFixed(2)}</span> /{' '}
                        <span className="text-rose-500">{totalLoss.toFixed(2)}</span>
                      </>
                    }
                    nightMode={nightMode}
                  />
                  <HelpMetric
                    label="Net P/L"
                    helpId="netPnl"
                    value={
                      <span className={`font-extrabold ${t.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {t.net.toFixed(2)}
                      </span>
                    }
                    nightMode={nightMode}
                  />
                  <HelpMetric label="Win rate" helpId="winRate" value={`${winRate.toFixed(1)}%`} nightMode={nightMode} />
                  <HelpMetric label="Avg duration" helpId="avgDur" value={toDurationStr(avgDuration)} nightMode={nightMode} />
                  <HelpMetric label="Max open" helpId="maxOpen" value={maxOpen} nightMode={nightMode} />
                </div>
              </div>
            );
          })}
          {!timeStats.length && (
            <div className={nightMode ? 'text-slate-400' : 'text-slate-500'}>No trades for this date.</div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold mb-2">Trades</div>
        <TradesTable trades={trades} nightMode={nightMode} />
      </div>
    </div>
  );
};

export default ExpandedHolidayDetails;
