import React from 'react';
import { ExchangeFilterMode } from '../../utils/deltaFutures';

type Props = {
  nightMode: boolean;
  compact?: boolean;
  mode: ExchangeFilterMode;
  onChange: (mode: ExchangeFilterMode) => void;
  pairCount: number;
  loading?: boolean;
};

const ExchangeFilterToggle: React.FC<Props> = ({
  nightMode,
  compact = false,
  mode,
  onChange,
  pairCount,
  loading = false
}) => {
  const toggle = (side: 'delta' | 'binance') => {
    onChange(mode === side ? 'both' : side);
  };

  const btnClass = (side: 'delta' | 'binance') => {
    const base = compact
      ? 'px-3.5 py-1.5 text-xs font-semibold transition-all first:rounded-l-full last:rounded-r-full border min-w-[4.25rem]'
      : 'px-5 py-2 text-sm font-semibold transition-all first:rounded-l-full last:rounded-r-full border min-w-[5.25rem]';
    const isOn = mode === 'both' || mode === side;

    if (!isOn) {
      return nightMode
        ? `${base} bg-slate-900 text-slate-500 border-slate-700`
        : `${base} bg-slate-50 text-slate-400 border-slate-200`;
    }

    if (mode === 'both') {
      if (side === 'delta') {
        return nightMode
          ? `${base} bg-sky-950/80 text-sky-300 border-sky-600 ring-1 ring-sky-500/40`
          : `${base} bg-sky-100 text-sky-800 border-sky-400 ring-1 ring-sky-300/60`;
      }
      return nightMode
        ? `${base} bg-amber-950/80 text-amber-300 border-amber-600 ring-1 ring-amber-500/40 border-l-0`
        : `${base} bg-amber-100 text-amber-800 border-amber-400 ring-1 ring-amber-300/60 border-l-0`;
    }

    if (side === 'delta') {
      return `${base} bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-500/25`;
    }
    return `${base} bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25 border-l-0`;
  };

  const caption =
    mode === 'delta'
      ? 'Delta futures pairs'
      : mode === 'binance'
        ? 'Pairs not listed on Delta'
        : loading
          ? 'Loading Delta futures…'
          : `${pairCount} Delta futures pairs`;

  return (
    <div className={`flex flex-wrap items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <span
        className={`font-semibold uppercase tracking-wide ${
          compact ? 'text-[10px]' : 'text-xs'
        } ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}
      >
        Exchange
      </span>
      <div
        className={`inline-flex rounded-full overflow-hidden shadow-sm ring-1 ${
          nightMode ? 'ring-slate-600' : 'ring-slate-200'
        }`}
        role="group"
        aria-label="Filter by Delta or Binance pairs"
      >
        <button
          type="button"
          className={btnClass('delta')}
          aria-pressed={mode === 'delta' || mode === 'both'}
          title="Pairs listed on Delta futures"
          onClick={() => toggle('delta')}
        >
          Delta
        </button>
        <button
          type="button"
          className={btnClass('binance')}
          aria-pressed={mode === 'binance' || mode === 'both'}
          title="Pairs that are not listed on Delta futures"
          onClick={() => toggle('binance')}
        >
          Binance
        </button>
      </div>
      <span className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>{caption}</span>
    </div>
  );
};

export default ExchangeFilterToggle;
