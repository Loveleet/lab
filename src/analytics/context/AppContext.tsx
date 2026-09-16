import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  ActiveFilters,
  AppState,
  FilterFieldConfig,
  FundamentalMapping,
  TimeSelection,
  Trade
} from '../types/trade';

type AppContextValue = {
  state: AppState;
  setTrades: (trades: Trade[]) => void;
  setMapping: (mapping: FundamentalMapping | undefined) => void;
  setFilterFields: (fields: FilterFieldConfig[]) => void;
  setHeaders: (headers: string[]) => void;
  setWarnings: (warnings: string[]) => void;
  toggleFilterValue: (field: string, value: string) => void;
  setFilterValues: (field: string, values: string[]) => void;
  clearFilters: () => void;
  setTimeSelection: (selection: TimeSelection) => void;
  resetTimeToLevel: (level: 'year' | 'month' | 'day' | 'time' | 'root') => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const emptyState: AppState = {
  trades: [],
  filterFields: [],
  activeFilters: {},
  timeSelection: {},
  headers: [],
  warnings: []
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(emptyState);

  const setTrades = (trades: Trade[]) =>
    setState((prev) => ({
      ...prev,
      trades
    }));

  const setMapping = (mapping: FundamentalMapping | undefined) =>
    setState((prev) => ({
      ...prev,
      fundamentalMapping: mapping
    }));

  const setFilterFields = (fields: FilterFieldConfig[]) =>
    setState((prev) => {
      const nextActive = { ...prev.activeFilters };
      fields.forEach((f) => {
        if (!nextActive[f.fieldName]) nextActive[f.fieldName] = new Set<string>();
      });
      return {
        ...prev,
        filterFields: fields,
        activeFilters: nextActive
      };
    });

  const setHeaders = (headers: string[]) =>
    setState((prev) => ({
      ...prev,
      headers
    }));

  const setWarnings = (warnings: string[]) =>
    setState((prev) => ({
      ...prev,
      warnings
    }));

  const toggleFilterValue = (field: string, value: string) =>
    setState((prev) => {
      const current = new Set(prev.activeFilters[field] || []);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      return {
        ...prev,
        activeFilters: {
          ...prev.activeFilters,
          [field]: current
        }
      };
    });

  const setFilterValues = (field: string, values: string[]) =>
    setState((prev) => ({
      ...prev,
      activeFilters: {
        ...prev.activeFilters,
        [field]: new Set(values)
      }
    }));

  const clearFilters = () =>
    setState((prev) => ({
      ...prev,
      activeFilters: {}
    }));

  const setTimeSelection = (selection: TimeSelection) =>
    setState((prev) => ({
      ...prev,
      timeSelection: selection
    }));

  const resetTimeToLevel = (level: 'year' | 'month' | 'day' | 'time' | 'root') =>
    setState((prev) => {
      const next: TimeSelection = { ...prev.timeSelection };
      if (level === 'root') {
        return { ...prev, timeSelection: {} };
      }
      if (level === 'year') {
        delete next.selectedMonth;
        delete next.selectedDay;
        delete next.selectedTimeBucket;
      }
      if (level === 'month') {
        delete next.selectedDay;
        delete next.selectedTimeBucket;
        delete next.selectedMinuteBucket;
      }
      if (level === 'day') {
        delete next.selectedTimeBucket;
        delete next.selectedMinuteBucket;
      }
      if (level === 'time') {
        delete next.selectedMinuteBucket;
      }
      return { ...prev, timeSelection: next };
    });

  const value = useMemo(
    () => ({
      state,
      setTrades,
      setMapping,
      setFilterFields,
      setHeaders,
      setWarnings,
      toggleFilterValue,
      setFilterValues,
      clearFilters,
      setTimeSelection,
      resetTimeToLevel
    }),
    [state]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return ctx;
};
