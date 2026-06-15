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
    if (lastUpdated == null || lastUpdated === "") return "—";
    let utcStr = String(lastUpdated).trim();
    if (!utcStr) return "—";
    if (!/Z$|[+-]\d{2}:?\d{2}$/.test(utcStr)) utcStr = utcStr.replace(" ", "T") + "Z";
    const t = new Date(utcStr).getTime();
    if (Number.isNaN(t)) return "—";
    const diffMs = Date.now() - t;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    if (diffSec < 60) return `${diffSec}s`;
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  } catch {
    return "—";
  }
}

function abbrevTrend(trendText) {
  const t = String(trendText || "").trim().toUpperCase();
  if (!t) return "";
  if (t.includes("BULL")) return "BULL";
  if (t.includes("BEAR")) return "BEAR";
  return t.length > 5 ? t.slice(0, 5) : t;
}

function EmaCell({ label, value, trendText, pct }) {
  const val = Number(pct);
  const trend = (trendText || "").toLowerCase();
  const isBull = trend.includes("bull");
  const isBear = trend.includes("bear");
  const shortTrend = abbrevTrend(trendText);
  const hasPct = pct != null && pct !== "" && !Number.isNaN(val);
  const hot = hasPct && val >= 90;
  const displayValue = shortTrend && hasPct
    ? `${shortTrend} ${val.toFixed(1)}%`
    : shortTrend
    ? shortTrend
    : hasPct
    ? `${val.toFixed(1)}%`
    : typeof value !== "undefined" && value !== null && String(value).trim() !== ""
    ? String(value).trim()
    : "—";

  const hotClass = hot
    ? isBull
      ? "ring-1 ring-green-400/80 bg-green-950/50"
      : isBear
      ? "ring-1 ring-red-400/80 bg-red-950/50"
      : ""
    : "";

  const valueClass = shortTrend
    ? hot
      ? isBull
        ? "text-green-400"
        : isBear
        ? "text-red-400"
        : "text-white"
      : isBull
      ? "text-green-400"
      : isBear
      ? "text-red-400"
      : "text-slate-100"
    : "text-slate-300";

  return (
    <div
      className={`flex-shrink-0 w-[4.75rem] sm:w-[5.25rem] rounded border border-blue-800/80 bg-slate-900/90 px-1.5 py-1 ${hotClass}`}
      title={displayValue}
    >
      <div className="text-[10px] leading-none text-blue-300/90 font-medium mb-1">{label}</div>
      <div className={`text-[11px] leading-tight font-semibold whitespace-nowrap ${valueClass}`}>
        {shortTrend && (isBull || isBear) && <span className="mr-0.5">{isBull ? "▲" : "▼"}</span>}
        {displayValue}
      </div>
    </div>
  );
}

/** Compact scrollable EMA row from /api/pairstatus. */
export default function EmaTrendGrid({ emaTrends, className = "" }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!emaTrends) return;
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, [emaTrends]);

  const lastUpdatedDisplay = useMemo(() => {
    if (!emaTrends) return "—";
    const lu = emaTrends.last_updated ?? emaTrends.Last_updated ?? emaTrends.lastUpdated;
    return getTimeAgo(lu);
  }, [emaTrends]);

  if (!emaTrends) return null;
  return (
    <div className={`flex-1 min-w-0 overflow-hidden ${className}`.trim()}>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
        <EmaCell label="Updated" value={lastUpdatedDisplay ?? "—"} />
        {EMA_INTERVALS.map(({ label, aliases }) => {
          const { trend, pct } = resolveEmaInterval(emaTrends, aliases);
          return <EmaCell key={label} label={label} trendText={trend} pct={pct} />;
        })}
      </div>
    </div>
  );
}
