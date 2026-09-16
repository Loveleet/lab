import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from './context/AppContext';
import HeaderBar from './components/layout/HeaderBar';
import MappingSettings from './components/mapping/MappingSettings';
import FilterBar from './components/filters/FilterBar';
import TimeView from './components/timeView/TimeView';
import TradesTable from './components/tradesTable/TradesTable';
import SymbolView from './components/pairView/SymbolView';
import HolidayView from './components/holiday/HolidayView';
import DayView from './components/dayView/DayView';
import FilePicker from './components/upload/FilePicker';
import { WorkerTrade } from './workers/aggregateWorker';
import {
  applyFilters,
  groupByDay,
  groupByMonth,
  groupByFiveMinuteBucket,
  groupBySymbol,
  groupByTimeBucket,
  groupByYear,
  TimeGroupingBasis
} from './utils/aggregation';
import { fetchTradesSmart } from '../tradesCache';
import {
  LIVE_MAPPING,
  liveFilterConfigs,
  liveHeadersFromRows,
  mapLabTradesToAnalytics
} from './utils/liveMap';
import { defaultFileFilterFields, guessMappingFromHeaders } from './utils/mappingGuess';
import { loadGroupingBasisFromStorage, saveGroupingBasisToStorage } from './utils/parsing';

const Dashboard: React.FC = () => {
  const { state, setTrades, setMapping, setFilterFields, setHeaders, setWarnings } = useAppContext();
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<'live' | 'files'>('live');
  const [fileName, setFileName] = useState('');
  const [liveStatus, setLiveStatus] = useState('');
  const [liveLoading, setLiveLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'time' | 'symbols' | 'holidays' | 'daywise'>('time');
  const [filtersHidden, setFiltersHidden] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [groupingBasis, setGroupingBasis] = useState<TimeGroupingBasis>(
    () => loadGroupingBasisFromStorage() || 'opening'
  );
  useEffect(() => {
    saveGroupingBasisToStorage(groupingBasis);
  }, [groupingBasis]);
  const liveRequestRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<{
    year: any[];
    month: any[];
    day: any[];
    time: any[];
    minutes: any[];
    symbol: any[];
  }>({ year: [], month: [], day: [], time: [], minutes: [], symbol: [] });

  const validTrades = useMemo(() => state.trades.filter((t) => !t.invalid), [state.trades]);

  const plainFilters = useMemo(() => {
    const obj: Record<string, string[]> = {};
    Object.entries(state.activeFilters).forEach(([k, set]) => {
      obj[k] = Array.from(set);
    });
    return obj;
  }, [state.activeFilters]);

  const workerTrades: WorkerTrade[] = useMemo(() => {
    const filterFields = state.filterFields.map((f) => f.fieldName);
    return validTrades.map((t) => {
      const rawSubset: Record<string, string> = {};
      filterFields.forEach((f) => {
        const val = t.raw[f];
        rawSubset[f] = val === undefined || val === null ? '' : String(val);
      });
      // Always include core fields for filtering reliability
      rawSubset['symbol'] = t.symbol;
      rawSubset['action'] = t.action;
      return {
        startTime: t.startTime,
        endTime: t.endTime,
        year: t.year,
        month: t.month,
        day: t.day,
        hour: t.hour,
        timeBucket: t.timeBucket,
        pnlValue: t.pnlValue,
        symbol: t.symbol,
        action: t.action,
        durationMs: t.durationMs,
        fiveMinuteBucket: t.fiveMinuteBucket,
        raw: rawSubset
      };
    });
  }, [validTrades, state.filterFields]);

  // Fallback stats on main thread if worker fails or returns empty
  const fallbackStats = useMemo(() => {
    const filtered = applyFilters(validTrades, state.activeFilters, {});
    const month =
      state.timeSelection.selectedYear !== undefined
        ? groupByMonth(filtered, state.timeSelection.selectedYear, groupingBasis)
        : [];
    const day =
      state.timeSelection.selectedYear !== undefined &&
      state.timeSelection.selectedMonth !== undefined
        ? groupByDay(filtered, state.timeSelection.selectedYear, state.timeSelection.selectedMonth, groupingBasis)
        : [];
    const time =
      state.timeSelection.selectedYear !== undefined &&
      state.timeSelection.selectedMonth !== undefined &&
      state.timeSelection.selectedDay !== undefined
        ? groupByTimeBucket(
            filtered,
            state.timeSelection.selectedYear,
            state.timeSelection.selectedMonth,
            state.timeSelection.selectedDay,
            groupingBasis
          )
        : [];
    const minutes =
      state.timeSelection.selectedYear !== undefined &&
      state.timeSelection.selectedMonth !== undefined &&
      state.timeSelection.selectedDay !== undefined &&
      state.timeSelection.selectedTimeBucket !== undefined
        ? groupByFiveMinuteBucket(
            filtered,
            state.timeSelection.selectedYear,
            state.timeSelection.selectedMonth,
            state.timeSelection.selectedDay,
            Number(state.timeSelection.selectedTimeBucket.split(':')[0]),
            groupingBasis
          )
        : [];
    const symbol = groupBySymbol(applyFilters(validTrades, state.activeFilters, state.timeSelection, groupingBasis));
    const year = groupByYear(filtered, groupingBasis);
    return { year, month, day, time, minutes, symbol };
  }, [validTrades, state.activeFilters, state.timeSelection, groupingBasis]);

  const currentTrades = useMemo(
    () => applyFilters(validTrades, state.activeFilters, state.timeSelection, groupingBasis),
    [validTrades, state.activeFilters, state.timeSelection, groupingBasis]
  );

  const avgTradesPerDay = useMemo(() => {
    const counts = new Map<string, number>();
    currentTrades.forEach((t) => {
      const key = `${t.year}-${t.month}-${t.day}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    if (counts.size === 0) return 0;
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    return total / counts.size;
  }, [currentTrades]);

  useEffect(() => {
    if (!validTrades.length) return;
    if (workerRef.current) workerRef.current.terminate();
    const worker = new Worker(new URL('./workers/aggregateWorker.ts', import.meta.url), {
      type: 'module'
    });
    workerRef.current = worker;
    setLoadingStats(true);
    worker.onmessage = (ev: MessageEvent<any>) => {
      if (ev.data.type === 'stats') {
        setStats({
          year: ev.data.year,
          month: ev.data.month,
          day: ev.data.day,
          time: ev.data.time,
          minutes: ev.data.minutes,
          symbol: ev.data.symbol
        });
        setLoadingStats(false);
      } else if (ev.data.type === 'error') {
        console.error(ev.data.error);
        setStats({ year: [], month: [], day: [], time: [], minutes: [], symbol: [] });
        setLoadingStats(false);
      }
    };
    const MAX_STATS_TRADES = 80000;
    const sample =
      workerTrades.length > MAX_STATS_TRADES
        ? workerTrades.filter(
            (_, idx) => idx % Math.ceil(workerTrades.length / MAX_STATS_TRADES) === 0
          )
        : workerTrades;

    worker.postMessage({
      type: 'stats',
      trades: sample,
      filters: plainFilters,
      timeSelection: state.timeSelection
    });
    return () => {
      worker.terminate();
    };
  }, [workerTrades, plainFilters, state.timeSelection]);

  useEffect(() => {
    if (sourceMode !== 'live') return;
    const requestId = ++liveRequestRef.current;
    let cancelled = false;
    setLiveLoading(true);
    setLiveStatus('Loading running trades and closed file…');
    (async () => {
      try {
        const result = await fetchTradesSmart({
          onProgress: (info: { message?: string }) => {
            if (!cancelled && info?.message) setLiveStatus(info.message);
          }
        });
        if (cancelled || requestId !== liveRequestRef.current) return;
        if (result?.authRequired) {
          setLiveStatus('Login required to load live trades');
          return;
        }
        const rows = Array.isArray(result?.trades) ? result.trades : [];
        const { trades, warnings } = mapLabTradesToAnalytics(rows);
        setRawRows(rows);
        setHeaders(liveHeadersFromRows(rows));
        setMapping(LIVE_MAPPING);
        setFilterFields(liveFilterConfigs());
        setTrades(trades);
        setWarnings(warnings);
        const running = rows.filter((t: any) => String(t?.type || '').toLowerCase().includes('running') || String(t?.type || '') === 'hedge_hold').length;
        setLiveStatus(`${trades.length.toLocaleString()} trades · ${running} live · PnL is current for open trades`);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setWarnings(['Failed to load live trades.']);
          setLiveStatus('Failed to load live trades');
        }
      } finally {
        if (!cancelled && requestId === liveRequestRef.current) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally only sourceMode: context setters change identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceMode]);

  const hasData = state.trades.length > 0 && !!state.fundamentalMapping;
  const symbolStats =
    (stats.symbol && stats.symbol.length ? stats.symbol : fallbackStats.symbol) || [];

  const pageBg = nightMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <HeaderBar
        onOpenMapping={() => setMappingOpen(true)}
        onOpenFiles={() => setFilesOpen(true)}
        sourceMode={sourceMode}
        onSourceMode={(mode) => {
          setSourceMode(mode);
          if (mode === 'files') {
            setTrades([]);
            setMapping(undefined);
            setRawRows([]);
            setFileName('');
            setLiveStatus('');
            setCloudStatus('');
            setFilesOpen(true);
          }
        }}
        canMap={rawRows.length > 0}
        fileName={fileName}
        liveStatus={liveStatus}
        liveLoading={liveLoading}
        cloudStatus={cloudStatus}
        nightMode={nightMode}
      />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-16">
        <div className="flex justify-end mt-4">
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold border shadow-sm ${
              nightMode
                ? 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600'
                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
            }`}
            onClick={() => setNightMode((v) => !v)}
          >
            {nightMode ? 'Light Mode' : 'Night Mode'}
          </button>
        </div>
        {!hasData ? (
          <div className="mt-16 text-center space-y-4">
            <div className="text-2xl font-semibold">
              {sourceMode === 'live'
                ? liveLoading
                  ? 'Loading live data…'
                  : 'No live trades yet'
                : 'Open a file to begin'}
            </div>
            <p className={`max-w-2xl mx-auto ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {sourceMode === 'live'
                ? 'Live uses the same feed as the dashboard: running trades from the database plus already-closed trades from the cloud file.'
                : 'Upload Excel from this PC (it is saved on the cloud) or pick a file already stored here, then map columns.'}
            </p>
          </div>
        ) : (
          <>
            {state.warnings.length > 0 && (
              <div
                className={`mt-4 mb-2 card p-3 text-sm border ${
                  nightMode
                    ? 'text-amber-200 bg-amber-900/30 border-amber-800'
                    : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}
              >
                <div className="font-semibold mb-1">Parsing warnings</div>
                <ul className="list-disc list-inside space-y-1">
                  {state.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 mb-4">
              <div className="flex justify-between items-center">
                {!filtersHidden && <FilterBar trades={currentTrades} nightMode={nightMode} />}
              <button
                className={`text-xs font-semibold px-3 py-2 rounded-full border shadow-sm ${
                  nightMode
                    ? 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
                onClick={() => setFiltersHidden((v) => !v)}
              >
                {filtersHidden ? 'Show Filters' : 'Hide Filters'}
              </button>
              <div
                className={`flex items-center space-x-2 border shadow-card rounded-full p-1 ${
                  nightMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}
              >
                <button
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    activeTab === 'time'
                      ? 'bg-slate-900 text-white'
                      : nightMode
                      ? 'text-slate-200'
                      : 'text-slate-600'
                  }`}
                  onClick={() => setActiveTab('time')}
                >
                  Time View
                </button>
                <button
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    activeTab === 'symbols'
                      ? 'bg-slate-900 text-white'
                      : nightMode
                      ? 'text-slate-200'
                      : 'text-slate-600'
                  }`}
                  onClick={() => setActiveTab('symbols')}
                >
                  Symbol View
                </button>
                <button
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    activeTab === 'holidays'
                      ? 'bg-slate-900 text-white'
                      : nightMode
                      ? 'text-slate-200'
                      : 'text-slate-600'
                  }`}
                  onClick={() => setActiveTab('holidays')}
                >
                  Holiday View
                </button>
                <button
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    activeTab === 'daywise'
                      ? 'bg-slate-900 text-white'
                      : nightMode
                      ? 'text-slate-200'
                      : 'text-slate-600'
                  }`}
                  onClick={() => setActiveTab('daywise')}
                >
                  Daywise View
                </button>
              </div>
              {/* Stats computed on main thread for accuracy */}
              </div>
            </div>

            {activeTab === 'time' ? (
              <>
                <TimeView
                  yearStats={fallbackStats.year}
                  monthStats={fallbackStats.month}
                  dayStats={fallbackStats.day}
                  timeStats={fallbackStats.time}
                  minuteStats={fallbackStats.minutes}
                  loading={false}
                  nightMode={nightMode}
                  groupingBasis={groupingBasis}
                  onGroupingBasisChange={setGroupingBasis}
                />
                <div
                  className={`mt-8 card p-4 ${nightMode ? 'bg-slate-900 text-slate-100 border border-slate-800' : ''}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-lg font-semibold">Trades</div>
                      <div className={`flex items-center gap-3 text-xs ${nightMode ? 'text-slate-300' : 'text-slate-500'}`}>
                        <span>
                          Showing {currentTrades.length.toLocaleString()} rows matching current filters
                          {groupingBasis === 'closing' ? ' by close time' : ' by open time'} (paginated)
                        </span>
                        {currentTrades.length > 0 && (
                          <span
                            className={`px-3 py-1 rounded-full border ${
                              nightMode
                                ? 'border-slate-700 bg-slate-800 text-slate-100'
                                : 'border-slate-200 bg-slate-100 text-slate-700'
                            }`}
                          >
                            Avg trades/day: {avgTradesPerDay.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <TradesTable trades={currentTrades} nightMode={nightMode} />
                </div>
              </>
            ) : activeTab === 'symbols' ? (
              <SymbolView symbolStats={symbolStats} nightMode={nightMode} />
            ) : activeTab === 'holidays' ? (
              <HolidayView trades={currentTrades} nightMode={nightMode} />
            ) : (
              <DayView trades={currentTrades} nightMode={nightMode} />
            )}
          </>
        )}
      </main>

      <MappingSettings
        open={mappingOpen}
        onClose={() => setMappingOpen(false)}
        headers={state.headers}
        rawRows={rawRows}
        nightMode={nightMode}
      />
      <FilePicker
        open={filesOpen}
        onClose={() => setFilesOpen(false)}
        nightMode={nightMode}
        onParsed={({ headers, rows, fileName: name }) => {
          setSourceMode('files');
          setRawRows(rows);
          setHeaders(headers);
          setTrades([]);
          setWarnings([]);
          setFileName(name);
          setCloudStatus('');
          const guessed = guessMappingFromHeaders(headers);
          if (!guessed) {
            setMapping(undefined);
            setMappingOpen(true);
            return;
          }
          setMapping(guessed);
          setFilterFields(defaultFileFilterFields(headers));
          const worker = new Worker(new URL('./workers/csvWorker.ts', import.meta.url), { type: 'module' });
          worker.onmessage = (ev: MessageEvent<any>) => {
            if (ev.data?.type === 'normalized') {
              setTrades(ev.data.trades || []);
              setWarnings(ev.data.warnings || []);
              worker.terminate();
            }
          };
          worker.onerror = () => {
            setMappingOpen(true);
            worker.terminate();
          };
          worker.postMessage({ type: 'normalize', rows, mapping: guessed });
        }}
        onCloudSave={(state, message) => {
          if (state === 'saving') setCloudStatus('saving to cloud…');
          else if (state === 'saved') setCloudStatus('saved on cloud');
          else setCloudStatus(message || 'opened locally — cloud save failed');
        }}
      />
    </div>
  );
};

export default Dashboard;
