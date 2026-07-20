import React from 'react';

function parseDurationToSeconds(input) {
  if (!input && input !== 0) return null;
  if (typeof input === 'number' && !Number.isNaN(input)) return Math.max(0, Math.floor(input));
  const str = String(input).trim().toLowerCase();
  if (!str) return null;
  // Support HH:MM:SS or MM:SS or SS
  if (/^\d{1,2}(:\d{1,2}){0,2}$/.test(str)) {
    const parts = str.split(':').map((p) => parseInt(p, 10) || 0);
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return h * 3600 + m * 60 + s;
    }
    if (parts.length === 2) {
      const [m, s] = parts;
      return m * 60 + s;
    }
    return parts[0];
  }
  // Support expressions like "1h 30m", "90s", "2m", "1h"
  let total = 0;
  const regex = /(\d+)(h|m|s)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'h') total += value * 3600;
    if (unit === 'm') total += value * 60;
    if (unit === 's') total += value;
  }
  if (total > 0) return total;
  // Fallback: plain number seconds
  const n = parseInt(str, 10);
  return Number.isNaN(n) ? null : Math.max(0, n);
}

function formatSmartDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '--';
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

const PRESETS = [
  { label: '30s', sec: 30 },
  { label: '1m', sec: 60 },
  { label: '2m', sec: 120 },
  { label: '5m', sec: 300 },
  { label: '10m', sec: 600 },
];

export default function RefreshControls({
  onRefresh,
  storageKey = 'default',
  initialIntervalSec = 20,
  initialAutoOn = false,
  style,
  className,
}) {
  const [autoOn, setAutoOn] = React.useState(() => {
    try {
      const saved = localStorage.getItem(`refresh_${storageKey}_autoOn`);
      return saved ? JSON.parse(saved) === true : initialAutoOn;
    } catch {
      return initialAutoOn;
    }
  });
  const [intervalSec, setIntervalSec] = React.useState(() => {
    try {
      const saved = localStorage.getItem(`refresh_${storageKey}_intervalSec`);
      const parsed = saved ? parseInt(saved, 10) : initialIntervalSec;
      return Number.isNaN(parsed) ? initialIntervalSec : parsed;
    } catch {
      return initialIntervalSec;
    }
  });
  const [lastRefreshTs, setLastRefreshTs] = React.useState(() => Date.now());
  const [tick, setTick] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [draftInterval, setDraftInterval] = React.useState('');
  const [settingsError, setSettingsError] = React.useState('');
  const settingsRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(`refresh_${storageKey}_autoOn`, JSON.stringify(autoOn));
    } catch {}
  }, [autoOn, storageKey]);

  React.useEffect(() => {
    try {
      localStorage.setItem(`refresh_${storageKey}_intervalSec`, String(intervalSec));
    } catch {}
  }, [intervalSec, storageKey]);

  React.useEffect(() => {
    if (!autoOn) return;
    const now = Date.now();
    const nextAt = lastRefreshTs + intervalSec * 1000;
    if (now >= nextAt) {
      triggerRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, autoOn, intervalSec]);

  React.useEffect(() => {
    if (!settingsOpen) return;
    setDraftInterval(String(intervalSec));
    setSettingsError('');
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onDoc = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen, intervalSec]);

  const triggerRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setLastRefreshTs(Date.now());
    try {
      await Promise.resolve(onRefresh && onRefresh());
    } catch (e) {
      // swallow
    } finally {
      setIsRefreshing(false);
    }
  };

  const remainingSec = React.useMemo(() => {
    if (!autoOn) return null;
    const nextAt = lastRefreshTs + intervalSec * 1000;
    return Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
  }, [autoOn, intervalSec, lastRefreshTs, tick]);

  const elapsedSec = React.useMemo(() => {
    if (autoOn) return null;
    return Math.max(0, Math.floor((Date.now() - lastRefreshTs) / 1000));
  }, [autoOn, lastRefreshTs, tick]);

  const applyInterval = (raw) => {
    const seconds = parseDurationToSeconds(raw);
    if (seconds == null || seconds <= 0) {
      setSettingsError('Enter a time > 0 (e.g. 45, 90s, 2m, 1h 5m)');
      return false;
    }
    setIntervalSec(seconds);
    setSettingsError('');
    setSettingsOpen(false);
    return true;
  };

  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    ...style,
  };
  const btnStyle = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#f3f4f6',
    fontWeight: 700,
    cursor: 'pointer',
  };

  return (
    <div className={className} style={containerStyle} ref={settingsRef}>
      <button
        type="button"
        onClick={triggerRefresh}
        disabled={isRefreshing}
        title={isRefreshing ? 'Refreshing...' : autoOn ? 'Click to refresh now' : 'Click to refresh'}
        style={{
          ...btnStyle,
          background: isRefreshing ? '#fbbf24' : '#e5e7eb',
          borderColor: isRefreshing ? '#f59e0b' : '#cbd5e1',
          opacity: isRefreshing ? 0.8 : 1,
          cursor: isRefreshing ? 'not-allowed' : 'pointer',
        }}
      >
        {isRefreshing ? '⟳' : '⟲'} {autoOn ? formatSmartDuration(remainingSec) : formatSmartDuration(elapsedSec)}
      </button>
      <button
        type="button"
        onClick={() => setAutoOn((v) => !v)}
        title="Auto Refresh"
        style={{
          ...btnStyle,
          background: autoOn ? 'linear-gradient(90deg, #22c55e 60%, #16a34a 100%)' : '#e5e7eb',
          color: autoOn ? '#fff' : '#111827',
          border: 'none',
        }}
      >
        {autoOn ? 'Auto: ON' : 'Auto: OFF'}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSettingsOpen((open) => !open);
        }}
        title={`Set interval (current: ${formatSmartDuration(intervalSec)})`}
        aria-expanded={settingsOpen}
        aria-label="Refresh interval settings"
        style={{
          ...btnStyle,
          padding: '6px 8px',
          borderRadius: 999,
          background: settingsOpen ? '#dbeafe' : '#f3f4f6',
          borderColor: settingsOpen ? '#93c5fd' : '#d1d5db',
        }}
      >
        ⚙️
      </button>

      {settingsOpen && (
        <div
          role="dialog"
          aria-label="Refresh interval"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 100,
            minWidth: 260,
            padding: 12,
            borderRadius: 12,
            border: '1px solid #d1d5db',
            background: '#fff',
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            color: '#111827',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            Auto refresh interval
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
            Current: <strong>{formatSmartDuration(intervalSec)}</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {PRESETS.map((p) => (
              <button
                key={p.sec}
                type="button"
                onClick={() => applyInterval(p.sec)}
                style={{
                  ...btnStyle,
                  padding: '4px 8px',
                  fontSize: 12,
                  background: intervalSec === p.sec ? '#2563eb' : '#f3f4f6',
                  color: intervalSec === p.sec ? '#fff' : '#111827',
                  borderColor: intervalSec === p.sec ? '#2563eb' : '#d1d5db',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyInterval(draftInterval);
            }}
            style={{ display: 'flex', gap: 6 }}
          >
            <input
              ref={inputRef}
              type="text"
              value={draftInterval}
              onChange={(e) => {
                setDraftInterval(e.target.value);
                setSettingsError('');
              }}
              placeholder="e.g. 90s, 2m, 1:30"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
              }}
            />
            <button
              type="submit"
              style={{
                ...btnStyle,
                background: '#2563eb',
                color: '#fff',
                borderColor: '#2563eb',
              }}
            >
              Set
            </button>
          </form>
          {settingsError ? (
            <div style={{ marginTop: 8, fontSize: 11, color: '#dc2626' }}>{settingsError}</div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 10, color: '#9ca3af' }}>
              Accepts seconds, 90s, 2m, 1h 5m, or MM:SS
            </div>
          )}
        </div>
      )}
    </div>
  );
}
