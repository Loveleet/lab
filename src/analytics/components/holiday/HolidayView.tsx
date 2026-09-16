import type { FC } from 'react';
import { useMemo, useState, useTransition } from 'react';
import type { Trade } from '../../types/trade';
import { holidays, Holiday } from '../../content/holidays';
import { computeMaxConcurrentTrades } from '../../utils/aggregation';
import { toDurationStr } from '../../utils/time';
import ExpandedHolidayDetails from './ExpandedHolidayDetails';
import TradesTable from '../tradesTable/TradesTable';
import { HelpMetric } from '../common/MetricField';

type Props = {
  trades: Trade[];
  nightMode: boolean;
};

type ExtendedHoliday = Holiday & { year?: number; baseDate?: string };

export type HolidayStat = {
  baseDate: string;
  years: Set<number>;
  holidays: ExtendedHoliday[];
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
  avgDuration: number;
  avgDurationStr: string;
  maxOpen: number;
};

const HolidayView: FC<Props> = ({ trades, nightMode }) => {
  const [pending, startTransition] = useTransition();
  const continents = useMemo(
    () => Array.from(new Set(holidays.map((h) => h.continent))).sort(),
    []
  );

  const countriesByContinent = useMemo(() => {
    const map = new Map<string, Holiday['country'][]>();
    holidays.forEach((h) => {
      const list = map.get(h.continent) || [];
      if (!list.includes(h.country)) list.push(h.country);
      map.set(h.continent, list);
    });
    return map;
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedContinents, setSelectedContinents] = useState<Set<string>>(new Set());
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'date' | 'trades' | 'net' | 'win'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const controlBtn = nightMode
    ? 'px-3 py-2 rounded-full border border-slate-700 bg-slate-800 text-slate-100 text-xs font-semibold'
    : 'px-3 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-semibold';

  const toggleContinent = (cont: string) => {
    startTransition(() => {
      setSelectedContinents((prev) => {
        const next = new Set(prev);
        if (next.has(cont)) {
          next.delete(cont);
          const countries = countriesByContinent.get(cont) || [];
          setSelectedCountries((prevCountries) => {
            const merged = new Set(prevCountries);
            countries.forEach((c) => merged.delete(c));
            return merged;
          });
        } else {
          next.add(cont);
          const countries = countriesByContinent.get(cont) || [];
          setSelectedCountries((prevCountries) => {
            const merged = new Set(prevCountries);
            countries.forEach((c) => merged.add(c));
            return merged;
          });
        }
        return next;
      });
    });
  };

  const toggleCountry = (countryCode: string) => {
    startTransition(() => {
      setSelectedCountries((prev) => {
        const next = new Set(prev);
        if (next.has(countryCode)) next.delete(countryCode);
        else next.add(countryCode);
        return next;
      });
    });
  };

  const tradeYears = useMemo(() => Array.from(new Set(trades.map((t) => t.year))).sort(), [trades]);

  const effectiveYears = useMemo(() => {
    if (selectedYears.size) return Array.from(selectedYears).sort();
    if (tradeYears.length) return tradeYears;
    return Array.from(new Set(holidays.map((h) => Number(h.date.split('-')[0]))));
  }, [selectedYears, tradeYears]);

  const expandedHolidays = useMemo<ExtendedHoliday[]>(() => {
    if (!effectiveYears.length)
      return holidays.map((h) => ({
        ...h,
        year: Number(h.date.split('-')[0]),
        baseDate: h.date.slice(5)
      }));
    return effectiveYears.flatMap((yr) =>
      holidays.map((h) => ({
        ...h,
        year: yr,
        baseDate: h.date.slice(5), // MM-DD
        date: `${yr}-${h.date.slice(5)}`
      }))
    );
  }, [effectiveYears]);

  const filteredHolidays = useMemo<ExtendedHoliday[]>(() => {
    if (selectedCountries.size === 0 && selectedContinents.size === 0) return expandedHolidays;
    return expandedHolidays.filter((h) => {
      const continentMatch = selectedContinents.size ? selectedContinents.has(h.continent) : true;
      const countryMatch = selectedCountries.size ? selectedCountries.has(h.countryCode) : true;
      return continentMatch && countryMatch;
    });
  }, [selectedCountries, selectedContinents, expandedHolidays]);

  const holidayStats = useMemo<HolidayStat[]>(() => {
    type Base = { baseDate: string; years: Set<number>; holidays: ExtendedHoliday[]; trades: Trade[] };
    const map = new Map<string, Base>();
    filteredHolidays.forEach((h) => {
      const key = (h as any).baseDate || h.date.slice(5);
      const entry: Base =
        map.get(key) || { baseDate: key, years: new Set<number>(), holidays: [], trades: [] };
      entry.holidays.push(h);
      if (h.year) entry.years.add(h.year);
      else entry.years.add(Number(h.date.split('-')[0]));
      map.set(key, entry);
    });
    trades.forEach((t) => {
      if (selectedYears.size && !selectedYears.has(t.year)) return;
      const key = `${t.month.toString().padStart(2, '0')}-${t.day.toString().padStart(2, '0')}`;
      const entry = map.get(key);
      if (entry) entry.trades.push(t);
    });
    const stats: HolidayStat[] = Array.from(map.values()).map((item) => {
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
      if (sortKey === 'date') return dir * a.baseDate.localeCompare(b.baseDate);
      if (sortKey === 'trades') return dir * (a.tradesCount - b.tradesCount);
      if (sortKey === 'net') return dir * (a.net - b.net);
      if (sortKey === 'win') return dir * (a.winRate - b.winRate);
      return 0;
    });
  }, [filteredHolidays, trades, selectedYears, sortDir, sortKey]);

  const matchedTrades = useMemo(() => {
    const baseDates = new Set(holidayStats.map((h) => h.baseDate));
    if (!baseDates.size) return [];
    return trades.filter((t) => {
      if (selectedYears.size && !selectedYears.has(t.year)) return false;
      const key = `${t.month.toString().padStart(2, '0')}-${t.day.toString().padStart(2, '0')}`;
      return baseDates.has(key);
    });
  }, [holidayStats, trades, selectedYears]);

  const selectedLabel =
    selectedCountries.size === 0 && selectedContinents.size === 0
      ? 'All countries'
      : `${selectedCountries.size.toLocaleString()} countries selected`;

  const years = useMemo(() => tradeYears, [tradeYears]);

  return (
    <section className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm font-semibold">Holiday Analysis</div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedCountries.size === 0 && selectedContinents.size === 0 ? (
            <span className={nightMode ? 'text-slate-300 text-xs' : 'text-slate-600 text-xs'}>
              Showing all countries
            </span>
          ) : (
            <span
              className={`text-xs px-3 py-1 rounded-full border ${
                nightMode
                  ? 'border-slate-700 bg-slate-800 text-slate-100'
                  : 'border-slate-200 bg-slate-100 text-slate-700'
              }`}
            >
              {selectedLabel}
            </span>
          )}
        </div>
        <button className={controlBtn} onClick={() => setSettingsOpen((v) => !v)}>
          {settingsOpen ? 'Close settings' : 'Settings'}
        </button>
        {pending && (
          <span className="text-xs text-slate-500 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            Loading…
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Sort:</span>
          <select
            className={nightMode ? 'bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded px-2 py-1' : 'bg-white border border-slate-200 text-xs rounded px-2 py-1'}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          >
            <option value="date">Date</option>
            <option value="trades">Trades</option>
            <option value="net">Net P/L</option>
            <option value="win">Win rate</option>
          </select>
          <button
            className={controlBtn}
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            {sortDir === 'asc' ? 'Asc' : 'Desc'}
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div
          className={`p-3 rounded-lg border ${
            nightMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="text-xs font-semibold mb-2">Select continents</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {continents.map((c) => (
              <button
                key={c}
                className={`${controlBtn} ${selectedContinents.has(c) ? 'ring-2 ring-indigo-500' : ''}`}
                onClick={() => toggleContinent(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="text-xs font-semibold mb-2">Select countries</div>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {Array.from(new Set(holidays.map((h) => h.countryCode)))
              .sort()
              .map((code) => {
                const country = holidays.find((h) => h.countryCode === code)?.country || code;
                return (
                  <button
                    key={code}
                    className={`${controlBtn} ${selectedCountries.has(code) ? 'ring-2 ring-indigo-500' : ''}`}
                    onClick={() => toggleCountry(code)}
                  >
                    {country} ({code})
                  </button>
                );
              })}
          </div>
          <div className="mt-3">
            <div className="text-xs font-semibold mb-2">Select years</div>
            <div className="flex flex-wrap gap-2">
              {years.map((y) => (
                <button
                  key={y}
                  className={`${controlBtn} ${selectedYears.has(y) ? 'ring-2 ring-indigo-500' : ''}`}
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
              <button className={controlBtn} onClick={() => setSelectedYears(new Set())}>
                All years
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {holidayStats.map((h) => {
          return (
            <div
              key={`${h.baseDate}-${Array.from(h.years).join('-')}-${h.holidays
                .map((x) => x.countryCode)
                .join('-')}`}
              className={`card p-4 border transition-transform hover:-translate-y-0.5 ${
                nightMode ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-card' : 'bg-white border-slate-200 shadow-card'
              }`}
              onClick={() => setExpandedDate((prev) => (prev === h.baseDate ? null : h.baseDate))}
            >
              <div className="text-xs font-semibold text-indigo-500 uppercase">Holiday</div>
              <div className="text-lg font-bold mt-1">{h.baseDate}</div>
              <div className={`text-xs mt-1 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {(() => {
                  const grouped = new Map<string, Set<string>>();
                  h.holidays.forEach((x) => {
                    x.names.forEach((n: string) => {
                      const set = grouped.get(n) || new Set<string>();
                      set.add(x.country);
                      grouped.set(n, set);
                    });
                  });
                  const labels = Array.from(grouped.entries()).map(([name, countries]) => {
                    const count = countries.size;
                    return count > 1 ? `${name} (${count} countries)` : `${name} (${Array.from(countries)[0]})`;
                  });
                  return labels.join(' · ');
                })()}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-2">
                  <HelpMetric label="Trades" helpId="trades" value={h.tradesCount.toLocaleString()} nightMode={nightMode} />
                  <HelpMetric
                    label="Profit / Loss count"
                    helpId="profitLossCount"
                    value={`${h.profitCount.toLocaleString()} / ${h.lossCount.toLocaleString()}`}
                    nightMode={nightMode}
                  />
                  <HelpMetric
                    label="Profit / Loss amount"
                    helpId="profitLossAmount"
                    value={
                      <>
                        <span className="text-emerald-500">{h.totalProfit.toFixed(2)}</span> /{' '}
                        <span className="text-rose-500">{h.totalLoss.toFixed(2)}</span>
                      </>
                    }
                    nightMode={nightMode}
                  />
                  <HelpMetric label="Avg duration" helpId="avgDur" value={h.avgDurationStr} nightMode={nightMode} />
                </div>
                <div className="space-y-2">
                  <HelpMetric
                    label="Buys / Sells"
                    helpId="buysSells"
                    value={`${h.buyCount.toLocaleString()} / ${h.sellCount.toLocaleString()}`}
                    nightMode={nightMode}
                  />
                  <HelpMetric
                    label="Net P/L"
                    helpId="netPnl"
                    value={
                      <span className={`font-extrabold text-lg ${h.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {h.net.toFixed(2)}
                      </span>
                    }
                    nightMode={nightMode}
                  />
                  <HelpMetric label="Win rate" helpId="winRate" value={`${h.winRate.toFixed(1)}%`} nightMode={nightMode} />
                  <HelpMetric label="Max open" helpId="maxOpen" value={h.maxOpen} nightMode={nightMode} />
                </div>
              </div>
            </div>
          );
        })}
        {!holidayStats.length && (
          <div className={`text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>
            No holidays match the current selection.
          </div>
        )}
      </div>

      {expandedDate && (
        <ExpandedHolidayDetails
          date={expandedDate}
          stats={holidayStats.find((h) => h.baseDate === expandedDate)}
          nightMode={nightMode}
        />
      )}

      {matchedTrades.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Trades</div>
            <div className={`text-xs ${nightMode ? 'text-slate-300' : 'text-slate-500'}`}>
              Showing {matchedTrades.length.toLocaleString()} rows matching selected holidays
            </div>
          </div>
          <TradesTable trades={matchedTrades} nightMode={nightMode} />
        </div>
      )}
    </section>
  );
};

export default HolidayView;
