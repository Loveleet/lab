import { useEffect, useState } from 'react';
import { DELTA_FUTURES_BASES } from './deltaFuturesPairs';

const INDIA_PRODUCTS = 'https://api.india.delta.exchange/v2/products';
const GLOBAL_PRODUCTS = 'https://api.delta.exchange/v2/products';
const QUOTE_SUFFIXES = ['USDT', 'USDC', 'BUSD', 'USD'];

export type ExchangeFilterMode = 'both' | 'delta' | 'binance';

export function normalizeSymbol(symbol: string): string {
  return String(symbol || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Base asset of a trade pair: YGGUSDT, YGG-USD, and YGGUSD all become YGG. */
export function pairBase(symbol: string): string {
  let s = normalizeSymbol(symbol);
  for (const quote of QUOTE_SUFFIXES) {
    if (s.endsWith(quote) && s.length > quote.length) {
      s = s.slice(0, -quote.length);
      break;
    }
  }
  return s;
}

export function isDeltaListed(symbol: string, bases: Set<string>): boolean {
  if (!bases.size) return false;
  const raw = normalizeSymbol(symbol);
  if (bases.has(raw)) return true;
  const base = pairBase(symbol);
  return base.length > 0 && bases.has(base);
}

async function fetchPerpBases(apiBase: string): Promise<string[]> {
  const bases: string[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(apiBase);
    url.searchParams.set('contract_types', 'perpetual_futures');
    url.searchParams.set('states', 'live');
    url.searchParams.set('page_size', '100');
    if (after) url.searchParams.set('after', after);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Delta products ${res.status}`);
    const data = await res.json();
    const rows = Array.isArray(data?.result) ? data.result : [];
    for (const row of rows) {
      const underlying = row?.underlying_asset?.symbol;
      if (underlying) bases.push(String(underlying).toUpperCase());
      else if (row?.symbol) bases.push(pairBase(String(row.symbol)));
    }
    after = data?.meta?.after || null;
    if (!after || rows.length === 0) break;
  }
  return bases;
}

/** Live perpetual futures on Delta India, with Delta global USDT perps included. */
export async function fetchDeltaFuturesBases(): Promise<string[]> {
  const [india, globalBases] = await Promise.all([
    fetchPerpBases(INDIA_PRODUCTS),
    fetchPerpBases(GLOBAL_PRODUCTS).catch(() => [] as string[])
  ]);
  return Array.from(new Set([...india, ...globalBases])).sort();
}

export function useDeltaFutures() {
  const [bases, setBases] = useState(() => new Set(DELTA_FUTURES_BASES));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDeltaFuturesBases()
      .then((list) => {
        if (!cancelled && list.length) setBases(new Set(list));
      })
      .catch((err) => {
        console.warn('[analytics] Using saved Delta futures list.', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { bases, count: bases.size, loading };
}
