import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Trade } from '../../types/trade';

type Props = {
  trades: Trade[];
  nightMode: boolean;
};

type ValueCount = {
  value: string;
  count: number;
};

const FilterBar: React.FC<Props> = ({ trades, nightMode }) => {
  const { state, toggleFilterValue, setFilterValues } = useAppContext();
  const [openField, setOpenField] = useState<string | null>(null);

  const valueCounts = useMemo<Record<string, ValueCount[]>>(() => {
    // Only compute counts for the currently open filter to avoid heavy recomputations on large data sets.
    if (!openField) return {};
    const field = state.filterFields.find((f) => f.fieldName === openField);
    if (!field) return {};
    const counts = new Map<string, number>();
    trades.forEach((t) => {
      const raw = t.raw[field.fieldName];
      const key = raw === undefined || raw === null ? 'Unknown' : String(raw);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return {
      [field.fieldName]: Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
    };
  }, [trades, state.filterFields, openField]);

  if (!state.filterFields.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state.filterFields.map((field) => {
        const activeCount = state.activeFilters[field.fieldName]?.size || 0;
        return (
          <div key={field.fieldName} className="relative">
            <button
              className={`px-3 py-2 rounded-full text-xs font-semibold border shadow-sm ${
                activeCount
                  ? 'bg-slate-900 text-white border-slate-900'
                  : nightMode
                  ? 'bg-slate-800 text-slate-100 border-slate-700'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
              onClick={() => setOpenField((prev) => (prev === field.fieldName ? null : field.fieldName))}
            >
              {field.displayName} {activeCount ? `(${activeCount})` : ''}
            </button>

            {openField === field.fieldName && (
              <div
                className={`absolute z-20 mt-2 w-64 max-h-80 overflow-y-auto rounded-xl shadow-lg p-3 ${
                  nightMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className={`text-xs font-semibold ${nightMode ? 'text-slate-100' : ''}`}>
                    {field.displayName}
                  </div>
                  <button
                    className={`text-[11px] ${nightMode ? 'text-slate-300' : 'text-slate-500'}`}
                    onClick={() => setOpenField(null)}
                  >
                    Close
                  </button>
                </div>
                <div className="flex justify-between text-[11px] mb-2">
                  <button
                    className={`${nightMode ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
                    onClick={() =>
                      setFilterValues(
                        field.fieldName,
                        valueCounts[field.fieldName]?.map((v) => v.value) || []
                      )
                    }
                  >
                    Select all
                  </button>
                  <button
                    className={`${nightMode ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
                    onClick={() => setFilterValues(field.fieldName, [])}
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-1">
                  {valueCounts[field.fieldName]?.map((item) => {
                    const checked = state.activeFilters[field.fieldName]
                      ? state.activeFilters[field.fieldName]?.has(item.value)
                      : true; // default checked when no filters yet
                    return (
                      <label
                        key={item.value}
                        className={`flex items-center justify-between text-xs rounded-lg px-2 py-1 cursor-pointer ${
                          nightMode ? 'hover:bg-slate-800 text-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFilterValue(field.fieldName, item.value)}
                          />
                          <span>{item.value}</span>
                        </div>
                        <span className={`text-[11px] ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.count}
                        </span>
                      </label>
                    );
                  })}
                  {!valueCounts[field.fieldName]?.length && (
                    <div className={`text-xs ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      No values in current subset.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FilterBar;
