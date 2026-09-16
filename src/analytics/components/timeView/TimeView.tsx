import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { GroupStats } from '../../types/trade';
import { TimeGroupingBasis } from '../../utils/aggregation';
import MetricField from '../common/MetricField';

type Props = {
  yearStats: GroupStats[];
  monthStats: GroupStats[];
  dayStats: GroupStats[];
  timeStats: GroupStats[];
  minuteStats?: GroupStats[];
  loading?: boolean;
  nightMode: boolean;
  groupingBasis: TimeGroupingBasis;
  onGroupingBasisChange: (basis: TimeGroupingBasis) => void;
};

const StatCard: React.FC<{
  stat: GroupStats;
  onClick?: () => void;
  highlight?: boolean;
  label: string;
  subtitle?: string;
  nightMode?: boolean;
}> = ({ stat, onClick, highlight, label, subtitle, nightMode }) => {
  const strength = Math.min(0.95, Math.abs(stat.netPnl) / (Math.abs(stat.netPnl) + 250));
  const isPositive = stat.netPnl >= 0;
  const avgPositive = stat.avgPnlPerTrade >= 0;
  const soFarPositive = (stat.plSoFar ?? 0) >= 0;
  const glow = isPositive
    ? `0 16px 42px -14px rgba(16,185,129,${(0.35 + strength * 0.35).toFixed(3)}), 0 0 0 1px rgba(16,185,129,0.12)`
    : `0 16px 42px -14px rgba(248,113,113,${(0.35 + strength * 0.35).toFixed(3)}), 0 0 0 1px rgba(248,113,113,0.12)`;
  const borderColor = nightMode
    ? 'border-slate-700 bg-slate-800'
    : isPositive
    ? 'border-emerald-200 bg-emerald-50/40'
    : 'border-rose-200 bg-rose-50/40';

  return (
    <div
      className={`card p-4 cursor-pointer transition-transform hover:-translate-y-0.5 ${
        highlight ? 'ring-2 ring-slate-900' : ''
      } ${borderColor}`}
      style={{ boxShadow: glow }}
      onClick={onClick}
    >
      <div className={`text-xs uppercase font-semibold ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{stat.key}</div>
      {subtitle && <div className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</div>}
      {(stat.openCount !== undefined || stat.closeCount !== undefined || stat.maxRunning !== undefined) && (
        <div
          className={`mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] leading-tight tabular-nums ${
            nightMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          <span>Open {stat.openCount ?? 0}</span>
          <span>Close {stat.closeCount ?? 0}</span>
          <span>Max running {stat.maxRunning ?? 0}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <MetricField label="Trades" helpId="trades" nightMode={nightMode}>
          <div className="font-semibold">{stat.tradesCount.toLocaleString()}</div>
        </MetricField>
        {stat.avgTradesPerActiveDay !== undefined && (
          <MetricField label="Avg trades/day" helpId="avgTradesPerActiveDay" nightMode={nightMode}>
            <div className="font-semibold">{stat.avgTradesPerActiveDay.toFixed(1)}</div>
          </MetricField>
        )}
        <MetricField label="Buys / Sells" helpId="buysSells" nightMode={nightMode}>
          <div className="font-semibold">
            {stat.buyCount.toLocaleString()} / {stat.sellCount.toLocaleString()}
          </div>
          <div className="text-xs mt-0.5">
            <span className={stat.buyPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{stat.buyPnl.toFixed(2)}</span>{' '}
            / <span className={stat.sellPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{stat.sellPnl.toFixed(2)}</span>
          </div>
        </MetricField>
        <MetricField label="Profit / Loss count" helpId="profitLossCount" nightMode={nightMode}>
          <div className="font-semibold">
            {stat.profitCount.toLocaleString()} / {stat.lossCount.toLocaleString()}
          </div>
        </MetricField>
        <div
          className={`col-span-2 rounded-xl px-3 py-3 ${
            nightMode
              ? isPositive
                ? 'bg-emerald-950/55 ring-1 ring-emerald-500/35 shadow-inner'
                : 'bg-rose-950/55 ring-1 ring-rose-500/35 shadow-inner'
              : isPositive
              ? 'bg-emerald-100 ring-1 ring-emerald-400/50 shadow-sm'
              : 'bg-rose-100 ring-1 ring-rose-400/50 shadow-sm'
          }`}
        >
          <div className="grid grid-cols-2 gap-4 items-end">
            <MetricField
              label="Net P/L"
              helpId="netPnl"
              nightMode={nightMode}
              labelClassName={`text-[10px] uppercase tracking-wider font-bold ${
                nightMode ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              <div
                className={`mt-0.5 font-black tracking-tight tabular-nums ${
                  isPositive
                    ? nightMode
                      ? 'text-2xl text-emerald-300 drop-shadow-sm'
                      : 'text-2xl text-emerald-600'
                    : nightMode
                    ? 'text-2xl text-rose-300 drop-shadow-sm'
                    : 'text-2xl text-rose-600'
                }`}
              >
                {stat.netPnl.toFixed(2)}
              </div>
            </MetricField>
            <div className="text-right">
              <MetricField
                label="P/L avg"
                helpId="plAvg"
                nightMode={nightMode}
                labelClassName={`text-[10px] uppercase tracking-wider font-bold ${
                  nightMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                <div
                  className={`mt-0.5 font-black tracking-tight tabular-nums ${
                    avgPositive
                      ? nightMode
                        ? 'text-xl text-emerald-300'
                        : 'text-xl text-emerald-600'
                      : nightMode
                      ? 'text-xl text-rose-300'
                      : 'text-xl text-rose-600'
                  }`}
                >
                  {stat.avgPnlPerTrade.toFixed(2)}
                </div>
                <div className={`mt-0.5 text-[10px] ${nightMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  per trade
                </div>
              </MetricField>
            </div>
          </div>
          {stat.plSoFar !== undefined && (
            <div
              className={`mt-3 pt-3 border-t ${
                nightMode ? 'border-emerald-500/20' : 'border-emerald-300/50'
              }`}
            >
              <MetricField
                label="P/L so far"
                helpId="plSoFar"
                nightMode={nightMode}
                labelClassName={`text-[10px] uppercase tracking-wider font-bold ${
                  nightMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                <div
                  className={`font-black tracking-tight tabular-nums text-lg ${
                    soFarPositive
                      ? nightMode
                        ? 'text-emerald-300'
                        : 'text-emerald-700'
                      : nightMode
                      ? 'text-rose-300'
                      : 'text-rose-700'
                  }`}
                >
                  {stat.plSoFar.toFixed(2)}
                </div>
              </MetricField>
            </div>
          )}
        </div>
        <MetricField label="Profit / Loss amount" helpId="profitLossAmount" nightMode={nightMode}>
          <div className="font-semibold">
            <span className="text-emerald-500">{stat.totalProfit.toFixed(2)}</span> /{' '}
            <span className="text-rose-500">{stat.totalLoss.toFixed(2)}</span>
          </div>
        </MetricField>
        <MetricField label="Win rate" helpId="winRate" nightMode={nightMode}>
          <div className="font-semibold">{stat.winRate.toFixed(1)}%</div>
        </MetricField>
        <MetricField label="Avg dur" helpId="avgDur" nightMode={nightMode}>
          <div className="font-semibold">{stat.avgDurationStr}</div>
        </MetricField>
        {label === 'time' && stat.hourPeakConcurrent !== undefined && (
          <MetricField label="Running (peak)" helpId="runningPeak" nightMode={nightMode}>
            <div className="font-semibold">{stat.hourPeakConcurrent}</div>
          </MetricField>
        )}
        {['year', 'month', 'day'].includes(label) && stat.hierarchicalAvgConcurrentTrades !== undefined && (
          <MetricField label="Avg open (nested)" helpId="avgOpenNested" nightMode={nightMode}>
            <div className="font-semibold">{stat.hierarchicalAvgConcurrentTrades.toFixed(2)}</div>
          </MetricField>
        )}
        {stat.maxConcurrentTrades !== undefined && (
          <MetricField label="Max open" helpId="maxOpen" nightMode={nightMode}>
            <div className="font-semibold">{stat.maxConcurrentTrades}</div>
          </MetricField>
        )}
      </div>
    </div>
  );
};

const TimeView: React.FC<Props> = ({
  yearStats,
  monthStats,
  dayStats,
  timeStats,
  minuteStats,
  loading,
  nightMode,
  groupingBasis,
  onGroupingBasisChange
}) => {
  const { state, setTimeSelection } = useAppContext();
  const [sortState, setSortState] = useState<
    Record<string, { field: string; dir: 'asc' | 'desc' }>
  >({
    year: { field: 'netPnl', dir: 'desc' },
    month: { field: 'netPnl', dir: 'desc' },
    day: { field: 'netPnl', dir: 'desc' },
    time: { field: 'netPnl', dir: 'desc' },
    minute: { field: 'netPnl', dir: 'desc' }
  });
  const [openSortFor, setOpenSortFor] = useState<string | null>(null);

  const selection = state.timeSelection;
  const toggleDir = (level: string) =>
    setSortState((prev) => ({
      ...prev,
      [level]: { ...prev[level], dir: prev[level]?.dir === 'asc' ? 'desc' : 'asc' }
    }));

  const sortOptions: Record<string, { field: string; label: string }[]> = {
    year: [
      { field: 'netPnl', label: 'Net P/L' },
      { field: 'tradesCount', label: 'Trades' },
      { field: 'winRate', label: 'Win rate' },
      { field: 'hierarchicalAvgConcurrentTrades', label: 'Avg open (nested)' },
      { field: 'key', label: 'Year (chronological)' }
    ],
    month: [
      { field: 'netPnl', label: 'Net P/L' },
      { field: 'plSoFar', label: 'P/L so far' },
      { field: 'tradesCount', label: 'Trades' },
      { field: 'winRate', label: 'Win rate' },
      { field: 'hierarchicalAvgConcurrentTrades', label: 'Avg open (nested)' },
      { field: 'key', label: 'Month (chronological)' }
    ],
    day: [
      { field: 'netPnl', label: 'Net P/L' },
      { field: 'plSoFar', label: 'P/L so far' },
      { field: 'tradesCount', label: 'Trades' },
      { field: 'winRate', label: 'Win rate' },
      { field: 'hierarchicalAvgConcurrentTrades', label: 'Avg open (nested)' },
      { field: 'weekday', label: 'Weekday (Mon-Sun)' },
      { field: 'key', label: 'Day (calendar order)' }
    ],
    time: [
      { field: 'netPnl', label: 'Net P/L' },
      { field: 'plSoFar', label: 'P/L so far' },
      { field: 'tradesCount', label: 'Trades' },
      { field: 'winRate', label: 'Win rate' },
      { field: 'hourPeakConcurrent', label: 'Running (peak)' },
      { field: 'key', label: 'Time (chronological)' }
    ],
    minute: [
      { field: 'netPnl', label: 'Net P/L' },
      { field: 'tradesCount', label: 'Trades' },
      { field: 'winRate', label: 'Win rate' },
      { field: 'key', label: 'Minute (chronological)' }
    ]
  };

  const sortStats = (stats: GroupStats[], level: string) => {
    const cfg = sortState[level] || { field: 'netPnl', dir: 'desc' };
    const dir = cfg.dir === 'desc' ? -1 : 1;
    const weekdayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    return [...stats].sort((a, b) => {
      const getVal = (s: GroupStats) => {
        if (cfg.field === 'weekday') {
          const [y, m, d] = s.key.split('-').map((v) => Number(v));
          const parsed = new Date(y || 2000, (m || 1) - 1, d || 1);
          const dayIdx = parsed.getDay(); // 0 Sunday
          return weekdayOrder[dayIdx === 0 ? 6 : dayIdx - 1];
        }
        if (cfg.field === 'key') return s.key;
        return (s as any)[cfg.field];
      };

      const av = getVal(a);
      const bv = getVal(b);
      if (cfg.field === 'key') return dir * String(av).localeCompare(String(bv));
      if (cfg.field === 'weekday')
        return dir * (weekdayOrder.indexOf(av as string) - weekdayOrder.indexOf(bv as string));
      const aNum = Number(av) || 0;
      const bNum = Number(bv) || 0;
      if (aNum === bNum) return dir * (b.tradesCount - a.tradesCount);
      return dir * (aNum - bNum);
    });
  };

  const currentSortLabel = (level: string) => {
    const field = sortState[level]?.field || 'netPnl';
    return sortOptions[level]?.find((o) => o.field === field)?.label || 'Net P/L';
  };

  const renderSortControls = (level: string) => (
    <div className="flex items-center gap-2 relative">
      <button
        className={`text-xs font-semibold px-3 py-2 rounded-full border shadow-sm ${
          nightMode
            ? 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600'
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
        onClick={() => toggleDir(level)}
      >
        Sort: {currentSortLabel(level)} ({sortState[level]?.dir === 'asc' ? '↑' : '↓'})
      </button>
      <button
        className={`text-[11px] px-2.5 py-1.5 rounded-full border shadow-sm ${
          nightMode
            ? 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600'
            : 'border-slate-200 bg-slate-50 hover:bg-white'
        }`}
        onClick={() => setOpenSortFor((prev) => (prev === level ? null : level))}
      >
        Choose label
      </button>
      {openSortFor === level && (
        <div
          className={`absolute right-0 top-11 z-10 w-52 rounded-lg shadow-lg p-2 space-y-1 ${
            nightMode ? 'bg-slate-800 border border-slate-700 text-slate-100' : 'bg-white border border-slate-200'
          }`}
        >
          {sortOptions[level]?.map((opt) => (
            <button
              key={opt.field}
              className={`w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-slate-50 ${
                sortState[level]?.field === opt.field
                  ? nightMode
                    ? 'bg-slate-700 font-semibold'
                    : 'bg-slate-100 font-semibold'
                  : ''
              }`}
              onClick={() => {
                setSortState((prev) => ({
                  ...prev,
                  [level]: { field: opt.field, dir: prev[level]?.dir || 'desc' }
                }));
                setOpenSortFor(null);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const avgTradesPerDay =
    dayStats && dayStats.length
      ? dayStats.reduce((acc, stat) => acc + stat.tradesCount, 0) / dayStats.length
      : 0;

  const setYear = (year: number) => setTimeSelection({ selectedYear: year });
  const setMonth = (month: number) =>
    setTimeSelection({ selectedYear: selection.selectedYear, selectedMonth: month });
  const setDay = (day: number) =>
    setTimeSelection({
      selectedYear: selection.selectedYear,
      selectedMonth: selection.selectedMonth,
      selectedDay: day
    });
  const setBucket = (bucket: string) =>
    setTimeSelection({
      selectedYear: selection.selectedYear,
      selectedMonth: selection.selectedMonth,
      selectedDay: selection.selectedDay,
      selectedTimeBucket: bucket
    });
  const setMinuteBucket = (bucket: string) =>
    setTimeSelection({
      selectedYear: selection.selectedYear,
      selectedMonth: selection.selectedMonth,
      selectedDay: selection.selectedDay,
      selectedTimeBucket: selection.selectedTimeBucket,
      selectedMinuteBucket: bucket
    });

  const renderGrid = (
    stats: GroupStats[],
    level: 'year' | 'month' | 'day' | 'time' | 'minute',
    subtitleBuilder?: (stat: GroupStats) => string | undefined
  ) => {
    if (!stats.length) {
      return (
        <div className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
          No data for this level.
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortStats(stats, level).map((stat) => (
          <StatCard
            key={stat.key}
            stat={stat}
            label={level}
            subtitle={subtitleBuilder ? subtitleBuilder(stat) : undefined}
            highlight={
              (level === 'year' && selection.selectedYear === Number(stat.key)) ||
              (level === 'month' &&
                selection.selectedMonth === Number(stat.key.split('-')[1])) ||
              (level === 'day' && selection.selectedDay === Number(stat.key.split('-')[2])) ||
              (level === 'time' && selection.selectedTimeBucket === stat.key) ||
              (level === 'minute' && selection.selectedMinuteBucket === stat.key)
            }
            nightMode={nightMode}
            onClick={() => {
              if (level === 'year') setYear(Number(stat.key));
              if (level === 'month') setMonth(Number(stat.key.split('-')[1]));
              if (level === 'day') setDay(Number(stat.key.split('-')[2]));
              if (level === 'time') setBucket(stat.key);
              if (level === 'minute') setMinuteBucket(stat.key);
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <section
      className={`mt-4 space-y-4 ${
        nightMode ? 'bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center space-x-2 text-sm">
        <button
          className={`font-semibold ${nightMode ? 'hover:text-slate-200' : 'hover:text-slate-900'}`}
          onClick={() => setTimeSelection({})}
        >
          All Years
        </button>
        {selection.selectedYear && (
          <>
            <span>›</span>
            <button
              className={`font-semibold ${nightMode ? 'hover:text-slate-200' : 'hover:text-slate-900'}`}
              onClick={() => setTimeSelection({ selectedYear: selection.selectedYear })}
            >
              {selection.selectedYear}
            </button>
          </>
        )}
        {selection.selectedMonth && selection.selectedYear && (
          <>
            <span>›</span>
            <button
              className={`font-semibold ${nightMode ? 'hover:text-slate-200' : 'hover:text-slate-900'}`}
              onClick={() =>
                setTimeSelection({
                  selectedYear: selection.selectedYear,
                  selectedMonth: selection.selectedMonth
                })
              }
            >
              Month {selection.selectedMonth}
            </button>
          </>
        )}
        {selection.selectedDay && selection.selectedMonth && selection.selectedYear && (
          <>
            <span>›</span>
            <button
              className={`font-semibold ${nightMode ? 'hover:text-slate-200' : 'hover:text-slate-900'}`}
              onClick={() =>
                setTimeSelection({
                  selectedYear: selection.selectedYear,
                  selectedMonth: selection.selectedMonth,
                  selectedDay: selection.selectedDay
                })
              }
            >
              Day {selection.selectedDay}
            </button>
          </>
        )}
        {selection.selectedTimeBucket && (
          <>
            <span>›</span>
            <span className="font-semibold">Bucket {selection.selectedTimeBucket}</span>
          </>
        )}
      </div>
      <div
        className={`inline-flex items-center gap-3 text-xs font-semibold ${
          nightMode ? 'text-slate-300' : 'text-slate-600'
        }`}
        role="radiogroup"
        aria-label="Group trades by open or close time"
      >
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="time-grouping-basis"
            checked={groupingBasis === 'opening'}
            onChange={() => onGroupingBasisChange('opening')}
          />
          Opening
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="time-grouping-basis"
            checked={groupingBasis === 'closing'}
            onChange={() => onGroupingBasisChange('closing')}
          />
          Closing
        </label>
      </div>
      </div>

      {loading && (
        <div className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading view...</div>
      )}

      {!selection.selectedYear && (
        <>
          <div className="flex items-center justify-between">
            <div className={`text-sm font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-700'}`}>Years</div>
            <div className="flex items-center gap-2">
              {renderSortControls('year')}
            </div>
          </div>
          {renderGrid(yearStats, 'year')}
        </>
      )}

      {selection.selectedYear && !selection.selectedMonth && (
        <>
          <div className="flex items-center justify-between">
            <div className={`text-sm font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-700'}`}>
              Months in {selection.selectedYear}
            </div>
            {renderSortControls('month')}
          </div>
          {renderGrid(monthStats, 'month')}
        </>
      )}

      {selection.selectedYear && selection.selectedMonth && !selection.selectedDay && (
        <>
          <div className="flex items-center justify-between">
            <div className={`text-sm font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-700'}`}>
              Days in {selection.selectedYear}-{selection.selectedMonth.toString().padStart(2, '0')}
            </div>
            <div className="flex items-center gap-3">
              {!!dayStats.length && (
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  nightMode ? 'bg-slate-800 text-slate-100 border border-slate-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  Avg trades/day: {avgTradesPerDay.toFixed(1)}
                </span>
              )}
              {renderSortControls('day')}
            </div>
          </div>
          {renderGrid(dayStats, 'day', (stat) => {
            const [y, m, d] = stat.key.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            return date.toLocaleDateString(undefined, { weekday: 'short' });
          })}
        </>
      )}

      {selection.selectedYear && selection.selectedMonth && selection.selectedDay && (
        <>
          <div className="flex items-center justify-between">
            <div className={`text-sm font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-700'}`}>
              Time buckets for {selection.selectedYear}-
              {selection.selectedMonth.toString().padStart(2, '0')}-
              {selection.selectedDay.toString().padStart(2, '0')}
            </div>
            {renderSortControls('time')}
          </div>
          {renderGrid(timeStats, 'time')}
          {selection.selectedTimeBucket && (
            <>
              <div className="flex items-center justify-between">
                <div className={`text-sm font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-700'}`}>
                  5-min buckets for {selection.selectedTimeBucket}
                </div>
                {renderSortControls('minute')}
              </div>
              {renderGrid(minuteStats || [], 'minute')}
            </>
          )}
        </>
      )}
    </section>
  );
};

export default TimeView;
