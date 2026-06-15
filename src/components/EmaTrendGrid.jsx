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

function pickEmaTrend(data, aliases) {
  if (!data || typeof data !== "object") return undefined;
  const entries = Object.entries(data);
  for (const alias of aliases) {
    const needle = `overallematrend${alias.toLowerCase()}`;
    const hit = entries.find(([k, v]) => {
      const nk = normalizeKey(k);
      return nk.includes("overallematrend") && !nk.includes("percent") && nk.includes(alias.toLowerCase()) && v != null && String(v).trim() !== "";
    });
    if (hit) return hit[1];
  }
  return undefined;
}

function pickEmaPct(data, aliases) {
  if (!data || typeof data !== "object") return undefined;
  const entries = Object.entries(data);
  for (const alias of aliases) {
    const hit = entries.find(([k, v]) => {
      const nk = normalizeKey(k);
      return nk.includes("overallematrend") && nk.includes("percent") && nk.includes(alias.toLowerCase()) && v != null && String(v).trim() !== "";
    });
    if (hit) return hit[1];
  }
  return undefined;
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
  const hot = pct != null && pct !== "" && !Number.isNaN(val) && val >= 90;
  const shortTrend = abbrevTrend(trendText);
  const hasTrend = shortTrend && pct != null && pct !== "" && !Number.isNaN(val);
  const displayValue = hasTrend
    ? `${shortTrend} ${val.toFixed(1)}%`
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

  const valueClass = hasTrend
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
        {hasTrend && (isBull || isBear) && <span className="mr-0.5">{isBull ? "▲" : "▼"}</span>}
        {displayValue}
      </div>
    </div>
  );
}

/** Compact scrollable EMA row from /api/pairstatus (merges fields across DB rows). */
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
        {EMA_INTERVALS.map(({ label, aliases }) => (
          <EmaCell
            key={label}
            label={label}
            trendText={pickEmaTrend(emaTrends, aliases)}
            pct={pickEmaPct(emaTrends, aliases)}
          />
        ))}
      </div>
    </div>
  );
}
