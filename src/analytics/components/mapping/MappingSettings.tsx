import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { FilterFieldConfig, FundamentalMapping } from '../../types/trade';
import {
  loadFilterFieldsFromStorage,
  loadMappingFromStorage,
  saveFilterFieldsToStorage,
  saveMappingToStorage
} from '../../utils/parsing';

type Props = {
  open: boolean;
  onClose: () => void;
  headers: string[];
  rawRows: Record<string, any>[];
  nightMode: boolean;
};

const requiredFields: { key: keyof FundamentalMapping; label: string }[] = [
  { key: 'startTimeCol', label: 'Trade Start Time' },
  { key: 'endTimeCol', label: 'Trade End Time' },
  { key: 'pnlCol', label: 'Net P/L' },
  { key: 'symbolCol', label: 'Symbol' },
  { key: 'actionCol', label: 'Action' }
];

const MappingSettings: React.FC<Props> = ({ open, onClose, headers, rawRows, nightMode }) => {
  const { setMapping, setTrades, setFilterFields, setWarnings } = useAppContext();
  const [localMapping, setLocalMapping] = useState<FundamentalMapping | undefined>();
  const [filterSelections, setFilterSelections] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [mappingSearch, setMappingSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const saved = loadMappingFromStorage();
    if (saved) setLocalMapping(saved);
    const savedFilters = loadFilterFieldsFromStorage();
    if (savedFilters) setFilterSelections(new Set(savedFilters));
  }, [open]);

  useEffect(() => {
    setError(null);
  }, [localMapping, filterSelections]);

  const availableFilters = useMemo(() => {
    if (!localMapping) return headers;
    // allow symbol and action to appear as filters even if mapped
    const used = new Set(Object.values(localMapping));
    return headers.filter((h) => h === localMapping.symbolCol || h === localMapping.actionCol || !used.has(h));
  }, [headers, localMapping]);

  const handleSave = async () => {
    if (!localMapping) {
      setError('Please map required columns.');
      return;
    }
    const values = Object.values(localMapping);
    const unique = new Set(values);
    if (unique.size !== values.length) {
      setError('Each role must use a unique column.');
      return;
    }
    const missing = requiredFields.filter((f) => !localMapping[f.key]);
    if (missing.length) {
      setError('All required roles must be mapped.');
      return;
    }
    if (!rawRows.length) {
      setError('Upload a file before mapping.');
      return;
    }

    setApplying(true);
    try {
      // Use worker normalization to avoid blocking
      const worker = new Worker(new URL('../../workers/csvWorker.ts', import.meta.url), {
        type: 'module'
      });
      worker.onmessage = (ev: MessageEvent<any>) => {
        if (ev.data.type === 'normalized') {
          const { trades, warnings } = ev.data;
          const filterConfigs: FilterFieldConfig[] = Array.from(filterSelections).map((f) => ({
            fieldName: f,
            displayName: f
          }));

          saveMappingToStorage(localMapping);
          saveFilterFieldsToStorage(filterConfigs.map((f) => f.fieldName));
          setMapping(localMapping);
          setTrades(trades);
          setFilterFields(filterConfigs);
          setWarnings(warnings);
          worker.terminate();
          onClose();
          setApplying(false);
        }
      };
      worker.postMessage({ type: 'normalize', rows: rawRows, mapping: localMapping });
      const filterConfigs: FilterFieldConfig[] = Array.from(filterSelections).map((f) => ({
        fieldName: f,
        displayName: f
      }));
    } catch (err) {
      console.error(err);
      setError('Failed to normalize trades.');
      setApplying(false);
    }
  };

  if (!open) return null;

  const panelClass = nightMode
    ? 'bg-slate-900 text-slate-100 border border-slate-800'
    : 'bg-white text-slate-900';
  const fieldLabel = nightMode ? 'text-slate-200' : 'text-slate-600';
  const inputClass = nightMode
    ? 'w-full rounded-lg border border-slate-700 bg-slate-800 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500'
    : 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';
  const selectClass = nightMode
    ? 'w-full rounded-lg border border-slate-700 bg-slate-800 text-slate-100 px-3 py-2 text-sm'
    : 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';
  const pillClass = nightMode
    ? 'flex items-center space-x-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm cursor-pointer hover:border-slate-600'
    : 'flex items-center space-x-2 rounded-lg border border-slate-200 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}
    >
      <div className={`rounded-2xl shadow-2xl max-w-4xl w-full p-6 overflow-y-auto max-h-[90vh] ${panelClass}`}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-xl font-semibold">Mapping Settings</div>
            <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Assign Excel columns to core roles and pick fields to expose as filters.
            </p>
          </div>
          <button
            className={`text-sm font-semibold ${nightMode ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {requiredFields.map((field) => {
            const searchTerm = (mappingSearch[field.key] || '').toLowerCase();
            const filteredHeaders = headers.filter((h) => h.toLowerCase().includes(searchTerm));
            return (
              <div key={field.key} className="space-y-2">
                <label className={`text-xs font-semibold ${fieldLabel}`}>{field.label}</label>
                <input
                  className={inputClass}
                  placeholder="Search columns..."
                  value={mappingSearch[field.key] || ''}
                  onChange={(e) =>
                    setMappingSearch((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
                <select
                  className={selectClass}
                  value={localMapping?.[field.key] || ''}
                  onChange={(e) =>
                    setLocalMapping((prev) => ({
                      ...(prev || ({} as FundamentalMapping)),
                      [field.key]: e.target.value
                    }))
                  }
                >
                  <option value="">Select column</option>
                  {filteredHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <div className={`text-sm font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-700'} mb-2`}>
            Filterable fields
          </div>
          {availableFilters.length === 0 ? (
            <div className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
              No extra columns available.
            </div>
          ) : (
            <>
              <div
                className={`flex items-center justify-between text-xs mb-2 ${
                  nightMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filterSelections.size === availableFilters.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilterSelections(new Set(availableFilters));
                      } else {
                        setFilterSelections(new Set());
                      }
                    }}
                  />
                  <span>Select all</span>
                </label>
                <button
                  className={`text-[11px] ${nightMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  onClick={() => setFilterSelections(new Set())}
                >
                  Clear all
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {availableFilters.map((field) => (
                  <label
                    key={field}
                    className={`${pillClass}`}
                  >
                    <input
                      type="checkbox"
                      checked={filterSelections.has(field)}
                      onChange={(e) => {
                        const next = new Set(filterSelections);
                        if (e.target.checked) next.add(field);
                        else next.delete(field);
                        setFilterSelections(next);
                      }}
                    />
                    <span>{field}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              nightMode ? 'border border-slate-700 text-slate-200 hover:border-slate-600' : 'border border-slate-200'
            }`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-sm disabled:opacity-60 ${
              nightMode ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
            onClick={handleSave}
            disabled={applying}
          >
            {applying ? 'Applying...' : 'Apply Mapping'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MappingSettings;
