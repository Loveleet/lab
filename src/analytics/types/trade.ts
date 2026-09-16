export type FundamentalMapping = {
  startTimeCol: string;
  endTimeCol: string;
  pnlCol: string;
  symbolCol: string;
  actionCol: string;
};

export type FilterFieldConfig = {
  fieldName: string;
  displayName: string;
};

export type Trade = {
  id: string;
  raw: Record<string, any>;
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
  action: 'BUY' | 'SELL' | string;
  durationMs: number;
  invalid?: boolean;
  invalidReason?: string;
};

export type ActiveFilters = Record<string, Set<string>>;

export type TimeSelection = {
  selectedYear?: number;
  selectedMonth?: number;
  selectedDay?: number;
  selectedTimeBucket?: string;
  selectedMinuteBucket?: string;
};

export type AppState = {
  trades: Trade[];
  fundamentalMapping?: FundamentalMapping;
  filterFields: FilterFieldConfig[];
  activeFilters: ActiveFilters;
  timeSelection: TimeSelection;
  headers: string[];
  warnings: string[];
};

export type GroupStats = {
  key: string;
  tradesCount: number;
  buyCount: number;
  sellCount: number;
  buyPnl: number;
  sellPnl: number;
  profitCount: number;
  lossCount: number;
  totalProfit: number;
  totalLoss: number;
  netPnl: number;
  /** Running total P/L from start of parent period (year→months, month→days, day→hours). */
  plSoFar?: number;
  avgPnlPerTrade: number;
  avgDurationMs: number;
  avgDurationStr: string;
  winRate: number;
  maxConcurrentTrades?: number;
  avgConcurrentTrades?: number;
  /** Mean of daily time-weighted avg concurrent (month); mean of those monthly values (year); same as avg concurrent for a single day. */
  hierarchicalAvgConcurrentTrades?: number;
  /** Peak concurrent trades during this clock hour on the selected calendar day (time bucket view). */
  hourPeakConcurrent?: number;
  daysWithTrades?: number;
  avgTradesPerActiveDay?: number;
  profitLossRatio?: number;
  /** Trades whose start time falls in this period. */
  openCount?: number;
  /** Trades whose end time falls in this period. */
  closeCount?: number;
  /** Peak concurrent trades during this period, including ones opened earlier. */
  maxRunning?: number;
};
