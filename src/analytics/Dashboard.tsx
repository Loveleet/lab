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
  groupBySymbol,
  groupByYear,
  computeTimeViewStats,
  TimeGroupingBasis
} from './utils/aggregation';
import { fetchTradesSmart } from '../tradesCache';
import {
  LIVE_MAPPING,
  liveFilterConfigs,
  liveHeadersFromRows,
  mapLabTradesToAnalytics
} from './utils/liveMap';
import { defaultFileFilterFields, guessMappingFromHeaders, mappingMatchesHeaders } from './utils/mappingGuess';
import {
  CANONICAL_MAPPING,
  compactWithMapping,
  isCanonicalAnalyticsHeaders,
  toExcelFile
} from './utils/compactSheet';
import { deleteAnalyticsFile, uploadAnalyticsFile } from './utils/fileApi';
import {
  loadFilterFieldsFromStorage,
  loadGroupingBasisFromStorage,
  loadMappingFromStorage,
  saveGroupingBasisToStorage
} from './utils/parsing';
import { FundamentalMapping, GroupStats, TimeSelection, Trade } from './types/trade';
import { ExchangeFilterMode, isDeltaListed, useDeltaFutures } from './utils/deltaFutures';
import FileProgress from './components/upload/FileProgress';

const TIME_VIEW_ROOT_KEY = 'years';

function drillLoadingText(sel: TimeSelection): string {
  if (sel.selectedYear === undefined) return 'Loading years';
  if (sel.selectedMonth === undefined) return `Loading months in ${sel.selectedYear}`;
  if (sel.selectedDay === undefined) {
    return `Loading days in ${sel.selectedYear}-${String(sel.selectedMonth).padStart(2, '0')}`;
  }
  if (sel.selectedTimeBucket === undefined) {
    return `Loading hours for ${sel.selectedYear}-${String(sel.selectedMonth).padStart(2, '0')}-${String(sel.selectedDay).padStart(2, '0')}`;
  }
  if (sel.selectedMinuteBucket === undefined) {
    return `Loading 5-minute buckets for ${sel.selectedTimeBucket}`;
  }
  return 'Loading';
}

const Dashboard: React.FC = () => {
  const { state, setTrades, setMapping, setFilterFields, setHeaders, setWarnings } = useAppContext();
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<'live' | 'files'>('live');
  const [fileName, setFileName] = useState('');
  const [cloudFileId, setCloudFileId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState('');
  const [liveLoading, setLiveLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('');
  const [fileStep, setFileStep] = useState<number | null>(null);
  const mappingConfirmed = useRef(false);
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

  const letPaint = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 40));
    });

  const normalizeRows = (
    rows: Record<string, any>[],
    mapping: FundamentalMapping,
    onDone?: () => void
  ) => {
    setFileStep(4);
    const worker = new Worker(new URL('./workers/csvWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<any>) => {
      if (ev.data?.type === 'normalized') {
        setTrades(ev.data.trades || []);
        setWarnings(ev.data.warnings || []);
        setFileStep(null);
        onDone?.();
        worker.terminate();
      }
    };
    worker.onerror = () => {
      setFileStep(null);
      worker.terminate();
    };
    worker.postMessage({ type: 'normalize', rows, mapping });
  };

  const openPreparedSheet = (
    rows: Record<string, any>[],
    headers: string[],
    mapping: FundamentalMapping,
    filterFields: string[],
    cloudId: string | null
  ) => {
    setRawRows(rows);
    setHeaders(headers);
    setMapping(mapping);
    setFilterFields(filterFields.map((fieldName) => ({ fieldName, displayName: fieldName })));
    setCloudFileId(cloudId);
    setCloudStatus(cloudId ? '' : '');
    normalizeRows(rows, mapping);
  };

  const resolveMapping = (headers: string[]) =>
    guessMappingFromHeaders(headers) ??
    (isCanonicalAnalyticsHeaders(headers) ? { ...CANONICAL_MAPPING } : undefined);

  const saveMappedFile = async (
    sourceRows: Record<string, any>[],
    headers: string[],
    name: string,
    previousId: string | null,
    mapping: FundamentalMapping,
    filterFields: string[]
  ) => {
    if (previousId && isCanonicalAnalyticsHeaders(headers)) {
      openPreparedSheet(sourceRows, headers, { ...CANONICAL_MAPPING }, filterFields, previousId);
      return;
    }
    setFileStep(3);
    await letPaint();
    const compact = compactWithMapping(sourceRows, mapping, filterFields);
    if (!compact.rows.length) {
      setFileStep(2);
      setCloudStatus('No rows with a symbol, open time, and close time to save');
      setMappingOpen(true);
      return;
    }
    setRawRows(compact.rows);
    setHeaders(compact.headers);
    setMapping(compact.mapping);
    const renamedFilters = filterFields.map((field) => {
      if (field === mapping.startTimeCol) return compact.mapping.startTimeCol;
      if (field === mapping.endTimeCol) return compact.mapping.endTimeCol;
      if (field === mapping.pnlCol) return compact.mapping.pnlCol;
      if (field === mapping.symbolCol) return compact.mapping.symbolCol;
      if (field === mapping.actionCol) return compact.mapping.actionCol;
      return field;
    });
    const filterNames = Array.from(new Set(renamedFilters.filter(Boolean)));
    setFilterFields(filterNames.map((fieldName) => ({ fieldName, displayName: fieldName })));
    await letPaint();
    normalizeRows(compact.rows, compact.mapping);
    setCloudStatus('Saving the smaller file…');
    await letPaint();
    uploadAnalyticsFile(toExcelFile(name || 'analytics.xlsx', compact.headers, compact.rows))
      .then(async (saved) => {
        if (previousId && previousId !== saved.id) await deleteAnalyticsFile(previousId).catch(() => {});
        setCloudFileId(saved.id);
        setCloudStatus(
          `Saved ${compact.rows.length.toLocaleString()} rows and ${compact.headers.length} columns`
        );
      })
      .catch((err: any) => {
        setCloudStatus(err?.message || 'Could not save the smaller file');
      });
  };
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
  const { bases: deltaBases, count: deltaPairCount, loading: deltaPairsLoading } = useDeltaFutures();
  const [exchangeMode, setExchangeMode] = useState<ExchangeFilterMode>('both');
  const scopedTrades = useMemo(() => {
    if (exchangeMode === 'both') return validTrades;
    return validTrades.filter((trade) => {
      const listed = isDeltaListed(trade.symbol, deltaBases);
      return exchangeMode === 'delta' ? listed : !listed;
    });
  }, [validTrades, exchangeMode, deltaBases]);

  const plainFilters = useMemo(() => {
    const obj: Record<string, string[]> = {};
    Object.entries(state.activeFilters).forEach(([k, set]) => {
      obj[k] = Array.from(set);
    });
    return obj;
  }, [state.activeFilters]);

  const workerTrades: WorkerTrade[] = useMemo(() => {
    const filterFields = state.filterFields.map((f) => f.fieldName);
    return scopedTrades.map((t) => {
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
  }, [scopedTrades, state.filterFields]);

  const selectionKey = [
    state.timeSelection.selectedYear ?? '',
    state.timeSelection.selectedMonth ?? '',
    state.timeSelection.selectedDay ?? '',
    state.timeSelection.selectedTimeBucket ?? '',
    state.timeSelection.selectedMinuteBucket ?? ''
  ].join('|');
  const drilled = state.timeSelection.selectedYear !== undefined;
  const timeLoadKey = drilled ? selectionKey : TIME_VIEW_ROOT_KEY;
  const [drillPhase, setDrillPhase] = useState<'loading' | 'loaded' | null>(null);
  const [readyKey, setReadyKey] = useState('');
  const [yearStats, setYearStats] = useState<GroupStats[]>([]);
  const [drillStats, setDrillStats] = useState<{
    month: GroupStats[];
    day: GroupStats[];
    time: GroupStats[];
    minutes: GroupStats[];
  }>({ month: [], day: [], time: [], minutes: [] });
  const [timeViewTrades, setTimeViewTrades] = useState<Trade[]>([]);

  const tradesAfterActiveFilters = useMemo(
    () => applyFilters(scopedTrades, state.activeFilters, {}, groupingBasis),
    [scopedTrades, state.activeFilters, groupingBasis]
  );

  const beginTimeViewLoad = () => {
    setReadyKey('');
    setDrillPhase('loading');
  };

  useEffect(() => {
    if (activeTab !== 'time') return;
    let cancelled = false;
    let hideTimer = 0;
    const key = timeLoadKey;
    const sel = state.timeSelection;
    setReadyKey('');
    setDrillPhase('loading');
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (!drilled) {
        setYearStats(groupByYear(tradesAfterActiveFilters, groupingBasis));
        setDrillStats({ month: [], day: [], time: [], minutes: [] });
        setTimeViewTrades(tradesAfterActiveFilters);
      } else {
        setDrillStats(computeTimeViewStats(tradesAfterActiveFilters, sel, groupingBasis));
        setTimeViewTrades(applyFilters(scopedTrades, state.activeFilters, sel, groupingBasis));
      }
      setReadyKey(key);
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        setDrillPhase('loaded');
        hideTimer = window.setTimeout(() => {
          if (!cancelled) setDrillPhase(null);
        }, 1400);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(hideTimer);
    };
  }, [
    activeTab,
    timeLoadKey,
    drilled,
    tradesAfterActiveFilters,
    groupingBasis,
    scopedTrades,
    state.activeFilters,
    state.timeSelection
  ]);

  const timeViewReady = activeTab === 'time' && readyKey === timeLoadKey;
  const timeViewPending = activeTab === 'time' && !timeViewReady;
  const currentTrades = useMemo(() => {
    if (activeTab === 'time') {
      return timeViewReady ? timeViewTrades : [];
    }
    return applyFilters(scopedTrades, state.activeFilters, state.timeSelection, groupingBasis);
  }, [
    activeTab,
    timeViewReady,
    timeViewTrades,
    scopedTrades,
    state.activeFilters,
    state.timeSelection,
    groupingBasis
  ]);

  const filterTradesRef = useRef<Trade[]>([]);
  if (!timeViewPending) filterTradesRef.current = currentTrades;
  const filterTrades = timeViewPending ? filterTradesRef.current : currentTrades;
  const drillBanner =
    timeViewPending || drillPhase === 'loading' ? 'loading' : drillPhase === 'loaded' ? 'loaded' : null;

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
      timeSelection: {}
    });
    return () => {
      worker.terminate();
    };
    // Drill-down stats are computed after the next view paints. Re-posting every
    // year/month click cloned the whole trade list and blocked that open.
  }, [workerTrades, plainFilters]);

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
  const symbolStats = useMemo(() => {
    if (activeTab !== 'symbols') return stats.symbol || [];
    return groupBySymbol(
      applyFilters(scopedTrades, state.activeFilters, state.timeSelection, groupingBasis)
    );
  }, [activeTab, stats.symbol, scopedTrades, state.activeFilters, state.timeSelection, groupingBasis]);

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
            setFileStep(null);
            setFilesOpen(true);
          }
        }}
        canMap={rawRows.length > 0}
        fileName={fileName}
        liveStatus={liveStatus}
        liveLoading={liveLoading}
        cloudStatus={cloudStatus}
        nightMode={nightMode}
        exchangeMode={exchangeMode}
        onExchangeMode={setExchangeMode}
        deltaPairCount={deltaPairCount}
        deltaPairsLoading={deltaPairsLoading}
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
                {!filtersHidden && (
                  <FilterBar
                    trades={filterTrades}
                    nightMode={nightMode}
                    onFilterChange={activeTab === 'time' ? beginTimeViewLoad : undefined}
                  />
                )}
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
                  yearStats={timeViewReady ? yearStats : []}
                  monthStats={timeViewReady ? drillStats.month : []}
                  dayStats={timeViewReady ? drillStats.day : []}
                  timeStats={timeViewReady ? drillStats.time : []}
                  minuteStats={timeViewReady ? drillStats.minutes : []}
                  loading={drillBanner === 'loading'}
                  statusNote={
                    drillBanner === 'loading'
                      ? drillLoadingText(state.timeSelection)
                      : drillBanner === 'loaded'
                        ? 'Loaded'
                        : ''
                  }
                  nightMode={nightMode}
                  groupingBasis={groupingBasis}
                  onNavigateStart={beginTimeViewLoad}
                  onGroupingBasisChange={(basis) => {
                    beginTimeViewLoad();
                    setGroupingBasis(basis);
                  }}
                />
                {timeViewReady && (
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
                )}
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
        onClose={() => {
          setMappingOpen(false);
          if (!mappingConfirmed.current) setFileStep(null);
          mappingConfirmed.current = false;
        }}
        headers={state.headers}
        rawRows={rawRows}
        nightMode={nightMode}
        onApply={(mapping, filterFields) => {
          mappingConfirmed.current = true;
          saveMappedFile(rawRows, state.headers, fileName, cloudFileId, mapping, filterFields);
        }}
      />
      <FilePicker
        open={filesOpen}
        onClose={() => setFilesOpen(false)}
        nightMode={nightMode}
        onStage={setFileStep}
        onParsed={({ headers, rows, fileName: name, fileId }) => {
          setSourceMode('files');
          setRawRows(rows);
          setHeaders(headers);
          setTrades([]);
          setWarnings([]);
          setFileName(name);
          setCloudFileId(fileId ?? null);
          setCloudStatus('');
          const mapping = resolveMapping(headers);
          if (mapping) {
            const filters = defaultFileFilterFields(headers).map((f) => f.fieldName);
            if (fileId && isCanonicalAnalyticsHeaders(headers)) {
              openPreparedSheet(rows, headers, mapping, filters, fileId);
              return;
            }
            setMapping(mapping);
            setFilterFields(defaultFileFilterFields(headers));
            normalizeRows(rows, mapping);
            return;
          }
          const stored = loadMappingFromStorage();
          const remembered = stored && mappingMatchesHeaders(stored, headers) ? stored : undefined;
          if (remembered) {
            const filters = (loadFilterFieldsFromStorage() || []).filter((field) => headers.includes(field));
            saveMappedFile(rows, headers, name, fileId ?? null, remembered, filters);
            return;
          }
          setMapping(undefined);
          setFileStep(2);
          setMappingOpen(true);
        }}
        onCloudSave={(status, message) => {
          if (status === 'saving') setCloudStatus('saving to cloud…');
          else if (status === 'saved') setCloudStatus(message || 'saved on cloud');
          else setCloudStatus(message || 'opened locally — cloud save failed');
        }}
      />
      {fileStep !== null && !filesOpen && !mappingOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}
        >
          <FileProgress step={fileStep} nightMode={nightMode} note={cloudStatus} className="mt-0" />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
