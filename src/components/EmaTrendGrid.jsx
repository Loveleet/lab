import React, { useState, useEffect, useMemo } from "react";

const EMA_INTERVALS = [
  { label: "1m", aliases: ["1m"] },
  { label: "5m", aliases: ["5m"] },
  { label: "15m", aliases: ["15m"] },
  { label: "1h", aliases: ["1h", "60m"] },
  { label: "4h", aliases: ["4h", "240m"] },
  { label: "1d", aliases: ["1d", "24h", "d"] },
];

function normalizeKey(key) {
  return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isTrendText(value) {
  const s = String(value ?? "").trim().toUpperCase();
  return s.includes("BULL") || s.includes("BEAR");
}

function isNumericValue(value) {
  if (value == null || String(value).trim() === "") return false;
  return !Number.isNaN(parseFloat(value));
}

/** DB sometimes stores trend in overall_ema_trend_percentage_* and % in overall_ema_trend_*. */
export function resolveEmaInterval(data, aliases) {
  if (!data || typeof data !== "object") return { trend: undefined, pct: undefined };

  let rawA;
  let rawB;
  for (const [k, v] of Object.entries(data)) {
    if (v == null || String(v).trim() === "") continue;
    const nk = normalizeKey(k);
    if (!nk.includes("overallematrend")) continue;
    const aliasHit = aliases.some((a) => nk.includes(String(a).toLowerCase()));
    if (!aliasHit) continue;
    if (nk.includes("percent")) rawB = v;
    else rawA = v;
  }

  if (rawA == null && rawB == null) return { trend: undefined, pct: undefined };
  if (isTrendText(rawA) && isNumericValue(rawB)) return { trend: rawA, pct: rawB };
  if (isTrendText(rawB) && isNumericValue(rawA)) return { trend: rawB, pct: rawA };
  if (isNumericValue(rawA) && !rawB) return { trend: undefined, pct: rawA };
  if (isNumericValue(rawB) && !rawA) return { trend: undefined, pct: rawB };
  if (isTrendText(rawA)) return { trend: rawA, pct: isNumericValue(rawB) ? rawB : undefined };
  if (isTrendText(rawB)) return { trend: rawB, pct: isNumericValue(rawA) ? rawA : undefined };
  if (isNumericValue(rawA)) return { trend: undefined, pct: rawA };
  if (isNumericValue(rawB)) return { trend: undefined, pct: rawB };
  return { trend: rawA, pct: rawB };
}

function getTimeAgo(lastUpdated) {
  try {
    if (lastUpdated == null || lastUpdated === "") return null;
    let utcStr = String(lastUpdated).trim();
    if (!utcStr) return null;
    if (!/Z$|[+-]\d{2}:?\d{2}$/.test(utcStr)) utcStr = utcStr.replace(" ", "T") + "Z";
    const t = new Date(utcStr).getTime();
    if (Number.isNaN(t)) return null;
    const diffMs = Date.now() - t;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    if (diffSec < 60) return `${diffSec}s`;
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  } catch {
    return null;
  }
}

function EmaCell({ label, trendText, pct, compact = false }) {
  const val = Number(pct);
  const trend = (trendText || "").toLowerCase();
  const isBull = trend.includes("bull");
  const isBear = trend.includes("bear");
  const hasPct = pct != null && pct !== "" && !Number.isNaN(val);
  const hot = hasPct && val >= 90;
  const empty = !isBull && !isBear && !hasPct;

  const shellClass = empty
    ? "border-slate-700/50 bg-slate-800/30"
    : isBull
    ? hot
      ? "border-emerald-500/50 bg-emerald-950/40 ring-1 ring-emerald-500/30"
      : "border-emerald-800/40 bg-emerald-950/20"
    : isBear
    ? hot
      ? "border-red-500/50 bg-red-950/40 ring-1 ring-red-500/30"
      : "border-red-800/40 bg-red-950/20"
    : "border-slate-700/50 bg-slate-800/40";

  const pctClass = isBull ? "text-emerald-400" : isBear ? "text-red-400" : "text-slate-400";

  return (
    <div
      className={`flex flex-col items-center justify-center w-full min-w-0 overflow-hidden ${
        compact
          ? `rounded-md border px-1 py-1 gap-0 ${shellClass}`
          : `rounded-lg border-2 px-2.5 py-3 min-h-[5.5rem] h-full ${shellClass}`
      }`}
      title={hasPct ? `${trendText || ""} ${val.toFixed(1)}%`.trim() : trendText || label}
    >
      <span
        className={`font-bold uppercase tracking-wide text-yellow-300 leading-tight ${
          compact ? "text-sm" : "text-base sm:text-lg mb-1.5"
        }`}
      >
        {label}
      </span>
      {empty ? (
        <span className={`${compact ? "text-sm" : "text-xs"} text-slate-600`}>—</span>
      ) : (
        <div className={`flex flex-col items-center justify-center w-full ${compact ? "gap-0" : "flex-1"}`}>
          {(isBull || isBear) && (
            <span
              className={`font-bold uppercase tracking-wide leading-tight ${
                compact ? "text-sm" : "text-xs sm:text-sm mb-1"
              } ${isBull ? "text-emerald-400" : "text-red-400"}`}
            >
              {isBull ? "▲ Bull" : "▼ Bear"}
            </span>
          )}
          {hasPct && (
            <span
              className={`font-bold tabular-nums ${
                compact ? "text-sm leading-tight" : "text-base sm:text-lg leading-none"
              } ${pctClass}`}
            >
              {val.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function EmaUpdatedAgo({ emaTrends }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!emaTrends) return;
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, [emaTrends]);

  const lastUpdatedDisplay = useMemo(() => {
    if (!emaTrends) return null;
    const lu = emaTrends.last_updated ?? emaTrends.Last_updated ?? emaTrends.lastUpdated;
    return getTimeAgo(lu);
  }, [emaTrends]);

  if (!lastUpdatedDisplay) return null;

  return (
    <span className="text-sm font-semibold normal-case tracking-normal text-emerald-400 tabular-nums">
      Updated {lastUpdatedDisplay} ago
    </span>
  );
}

/** EMA trend grid from /api/pairstatus. */
export default function EmaTrendGrid({ emaTrends, className = "", compact = false }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!emaTrends) return;
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, [emaTrends]);

  const lastUpdatedDisplay = useMemo(() => {
    if (!emaTrends) return null;
    const lu = emaTrends.last_updated ?? emaTrends.Last_updated ?? emaTrends.lastUpdated;
    return getTimeAgo(lu);
  }, [emaTrends]);

  if (!emaTrends) return null;

  return (
    <div className={`flex flex-col w-full min-w-0 ${compact ? "" : "h-full"} ${className}`.trim()}>
      {compact ? null : (
        <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-violet-600/40 shrink-0">
          <span className="text-xs font-bold uppercase tracking-widest text-violet-300">EMA Trend</span>
          {lastUpdatedDisplay && (
            <span className="text-[10px] text-slate-500 tabular-nums">
              Updated <span className="text-slate-400">{lastUpdatedDisplay}</span> ago
            </span>
          )}
        </div>
      )}
      <div
        className={`grid w-full min-w-0 ${
          compact ? "grid-cols-6 gap-1.5" : "grid-cols-3 sm:grid-cols-6 gap-3 flex-1 auto-rows-fr"
        }`}
      >
        {EMA_INTERVALS.map(({ label, aliases }) => {
          const { trend, pct } = resolveEmaInterval(emaTrends, aliases);
          return <EmaCell key={label} label={label} trendText={trend} pct={pct} compact={compact} />;
        })}
      </div>
    </div>
  );
}
