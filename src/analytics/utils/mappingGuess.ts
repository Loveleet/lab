import { FilterFieldConfig, FundamentalMapping } from '../types/trade';

const START_CANDIDATES = [
  'execute_time',
  'operator_trade_time',
  'execute time',
  'start_time',
  'start time'
];

const END_CANDIDATES = [
  'close_time',
  'operator_close_time',
  'close time',
  'end_time',
  'end time',
  'closetime'
];

const PNL_CANDIDATES = [
  'profit loss',
  'pl_after_comm',
  'net pnl',
  'net_pnl',
  'pnl',
  'pl'
];

const SYMBOL_CANDIDATES = ['symbol', 'pair'];
const ACTION_CANDIDATES = ['action', 'side'];

const FILTER_CANDIDATES = [
  'symbol',
  'pair',
  'action',
  'exit_reason',
  'close_cond',
  'entry_mode',
  'machineid',
  'interval',
  'signalfrom',
  'type'
];

function pickHeader(headers: string[], candidates: string[]): string | undefined {
  const byLower = new Map(headers.map((h) => [String(h).trim().toLowerCase(), h]));
  for (const candidate of candidates) {
    const hit = byLower.get(candidate.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

export function guessMappingFromHeaders(headers: string[]): FundamentalMapping | undefined {
  const startTimeCol = pickHeader(headers, START_CANDIDATES);
  const endTimeCol = pickHeader(headers, END_CANDIDATES);
  const pnlCol = pickHeader(headers, PNL_CANDIDATES);
  const symbolCol = pickHeader(headers, SYMBOL_CANDIDATES);
  const actionCol = pickHeader(headers, ACTION_CANDIDATES);
  if (!startTimeCol || !endTimeCol || !pnlCol || !symbolCol || !actionCol) return undefined;
  return { startTimeCol, endTimeCol, pnlCol, symbolCol, actionCol };
}

export function defaultFileFilterFields(headers: string[]): FilterFieldConfig[] {
  const byLower = new Map(headers.map((h) => [String(h).trim().toLowerCase(), h]));
  return FILTER_CANDIDATES.map((name) => byLower.get(name.toLowerCase()))
    .filter((h): h is string => !!h)
    .map((fieldName) => ({ fieldName, displayName: fieldName }));
}

export function mappingMatchesHeaders(mapping: FundamentalMapping | undefined, headers: string[]): boolean {
  if (!mapping) return false;
  const set = new Set(headers);
  return Object.values(mapping).every((col) => set.has(col));
}
