import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { ACTION_FILTER_FIELD, getActionFilterMode } from '../../utils/aggregation';

type Props = {
  nightMode: boolean;
  compact?: boolean;
};

const ActionFilterToggle: React.FC<Props> = ({ nightMode, compact = false }) => {
  const { state, setFilterValues } = useAppContext();
  const mode = getActionFilterMode(state.activeFilters);

  const toggle = (side: 'BUY' | 'SELL') => {
    if (mode === side) {
      setFilterValues(ACTION_FILTER_FIELD, []);
    } else {
      setFilterValues(ACTION_FILTER_FIELD, [side]);
    }
  };

  const btnClass = (side: 'BUY' | 'SELL') => {
    const base = compact
      ? 'px-3.5 py-1.5 text-xs font-semibold transition-all first:rounded-l-full last:rounded-r-full border min-w-[3.5rem]'
      : 'px-5 py-2 text-sm font-semibold transition-all first:rounded-l-full last:rounded-r-full border min-w-[4.5rem]';
    const isOn = mode === 'both' || mode === side;

    if (!isOn) {
      return nightMode
        ? `${base} bg-slate-900 text-slate-500 border-slate-700`
        : `${base} bg-slate-50 text-slate-400 border-slate-200`;
    }

    if (mode === 'both') {
      if (side === 'BUY') {
        return nightMode
          ? `${base} bg-emerald-950/80 text-emerald-300 border-emerald-600 ring-1 ring-emerald-500/40`
          : `${base} bg-emerald-100 text-emerald-800 border-emerald-400 ring-1 ring-emerald-300/60`;
      }
      return nightMode
        ? `${base} bg-rose-950/80 text-rose-300 border-rose-600 ring-1 ring-rose-500/40 border-l-0`
        : `${base} bg-rose-100 text-rose-800 border-rose-400 ring-1 ring-rose-300/60 border-l-0`;
    }

    if (side === 'BUY') {
      return `${base} bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/25`;
    }
    return `${base} bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/25 border-l-0`;
  };

  return (
    <div className={`flex flex-wrap items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <span
        className={`font-semibold uppercase tracking-wide ${
          compact ? 'text-[10px]' : 'text-xs'
        } ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}
      >
        Action
      </span>
      <div
        className={`inline-flex rounded-full overflow-hidden shadow-sm ring-1 ${
          nightMode ? 'ring-slate-600' : 'ring-slate-200'
        }`}
        role="group"
        aria-label="Filter by buy or sell"
      >
        <button type="button" className={btnClass('BUY')} aria-pressed={mode === 'BUY' || mode === 'both'} onClick={() => toggle('BUY')}>
          Buy
        </button>
        <button type="button" className={btnClass('SELL')} aria-pressed={mode === 'SELL' || mode === 'both'} onClick={() => toggle('SELL')}>
          Sell
        </button>
      </div>
      {mode === 'BUY' && !compact && (
        <span className={`text-xs ${nightMode ? 'text-emerald-400' : 'text-emerald-700'}`}>Buy trades only</span>
      )}
      {mode === 'SELL' && !compact && (
        <span className={`text-xs ${nightMode ? 'text-rose-400' : 'text-rose-700'}`}>Sell trades only</span>
      )}
    </div>
  );
};

export default ActionFilterToggle;
