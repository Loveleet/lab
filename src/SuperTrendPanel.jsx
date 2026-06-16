import React, { useEffect, useState } from "react";

function formatSinceTimeCompact(timestamp, now) {
  const ts = new Date(timestamp).getTime();
  if (Number.isNaN(ts)) return "—";
  let diff = Math.floor((now - ts) / 1000);
  if (diff < 0) diff = 0;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function SuperTrendChip({ row, now }) {
  const ts = new Date(row.timestamp).getTime();
  const diff = Number.isNaN(ts) ? 0 : Math.floor((now - ts) / 1000);
  const fresh = diff < 2700;
  const trend = String(row.trend || "").toUpperCase();
  const isBuy = trend === "BUY";
  const isSell = trend === "SELL";

  const trendClass = isBuy
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-600/40"
    : isSell
    ? "bg-red-500/15 text-red-400 border-red-600/40"
    : "bg-slate-700/40 text-slate-300 border-slate-600/40";

  return (
    <div
      className={`flex flex-1 min-w-[9rem] items-center gap-2 rounded-lg border px-2.5 py-2 ${
        fresh ? "border-amber-500/50 bg-amber-500/5" : "border-slate-700/50 bg-slate-800/40"
      }`}
      title={`${row.source} ${row.trend} — ${new Date(row.timestamp).toLocaleString()}`}
    >
      <span className="text-[11px] font-medium text-slate-300 truncate">{row.source}</span>
      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${trendClass}`}>
        {trend || "—"}
      </span>
      <span className={`text-[10px] tabular-nums shrink-0 ml-auto ${fresh ? "text-amber-400 font-medium" : "text-slate-500"}`}>
        {formatSinceTimeCompact(row.timestamp, now)}
      </span>
    </div>
  );
}

function SuperTrendPanel({ data = [] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col w-full min-w-0 h-full">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 shrink-0">SuperTrend</span>
        {data.length > 0 && (
          <span className="text-[10px] text-slate-500 shrink-0">{data.length} signal{data.length !== 1 ? "s" : ""}</span>
        )}
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-slate-600 py-2 text-center rounded-lg border border-dashed border-slate-700/50 w-full">
          No signals
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 w-full">
          {data.map((row, i) => (
            <SuperTrendChip key={`${row.source}-${row.timestamp}-${i}`} row={row} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

export default SuperTrendPanel;
