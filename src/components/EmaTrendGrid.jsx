import React, { useState, useEffect } from "react";

const EMA_INTERVALS = [
  { label: "EMA 1m", trendKeys: ["overall_ema_trend_1m"], pctKeys: ["overall_ema_trend_percentage_1m"] },
  { label: "EMA 5m", trendKeys: ["overall_ema_trend_5m"], pctKeys: ["overall_ema_trend_percentage_5m"] },
  { label: "EMA 15m", trendKeys: ["overall_ema_trend_15m"], pctKeys: ["overall_ema_trend_percentage_15m"] },
  {
    label: "EMA 1h",
    trendKeys: ["overall_ema_trend_1h", "overall_ema_trend_60m", "overall_ema_trend_1H"],
    pctKeys: ["overall_ema_trend_percentage_1h", "overall_ema_trend_percentage_60m", "overall_ema_trend_percentage_1H"],
  },
  {
    label: "EMA 4h",
    trendKeys: ["overall_ema_trend_4h", "overall_ema_trend_240m", "overall_ema_trend_4H"],
    pctKeys: ["overall_ema_trend_percentage_4h", "overall_ema_trend_percentage_240m", "overall_ema_trend_percentage_4H"],
  },
  {
    label: "EMA 1d",
    trendKeys: ["overall_ema_trend_1d", "overall_ema_trend_24h", "overall_ema_trend_1D", "overall_ema_trend_D"],
    pctKeys: ["overall_ema_trend_percentage_1d", "overall_ema_trend_percentage_24h", "overall_ema_trend_percentage_1D", "overall_ema_trend_percentage_D"],
  },
];

function pickField(data, keys) {
  if (!data || typeof data !== "object") return undefined;
  for (const key of keys) {
    const val = data[key];
    if (val != null && String(val).trim() !== "") return val;
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
  return t.length > 6 ? t.slice(0, 6) : t;
}

function pctColor(valNum, isBull, isBear) {
  const v = Number(valNum);
  if (Number.isNaN(v)) return { color: "rgb(255,255,255)" };
  const tRaw = Math.max(0, Math.min(v / 90, 1));
  const t = Math.pow(tRaw, 0.6);
  const target = isBull ? [34, 197, 94] : isBear ? [239, 68, 68] : [255, 255, 255];
  const r = Math.round(255 + (target[0] - 255) * t);
  const g = Math.round(255 + (target[1] - 255) * t);
  const b = Math.round(255 + (target[2] - 255) * t);
  return { color: `rgb(${r}, ${g}, ${b})` };
}

function EmaCell({ header, value, trendText, pct }) {
  const val = Number(pct);
  const trend = (trendText || "").toLowerCase();
  const isBull = trend.includes("bull");
  const isBear = trend.includes("bear");
  const hot = pct != null && pct !== "" && !Number.isNaN(val) && val >= 90;
  const baseBox =
    "w-full min-w-0 flex flex-col rounded-md border transition-all duration-200 ease-out " +
    "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 " +
    "px-1.5 py-1 sm:px-2 sm:py-1.5";
  const hotDecor = hot
    ? isBear
      ? " bg-red-50 dark:bg-red-950/40 ring-1 ring-red-300 dark:ring-red-800"
      : isBull
      ? " bg-green-50 dark:bg-green-950/40 ring-1 ring-green-300 dark:ring-green-800"
      : ""
    : "";
  const valueStyle = pct != null && pct !== "" && !hot ? pctColor(val, isBull, isBear) : undefined;
  const valueClass = pct != null && pct !== "" && hot
    ? isBull ? "text-green-600" : isBear ? "text-red-600" : "text-black dark:text-white"
    : "text-black dark:text-white";
  const shortTrend = abbrevTrend(trendText);
  const displayValue = pct != null && pct !== "" && shortTrend
    ? `${shortTrend} ${!Number.isNaN(val) ? val.toFixed(1) : pct}%`
    : typeof value !== "undefined" && value !== null && String(value).trim() !== ""
    ? String(value).trim()
    : "—";

  return (
    <div className={`${baseBox} ${hotDecor}`.trim()}>
      <span className="text-blue-700 dark:text-blue-200 font-semibold text-[9px] sm:text-[10px] leading-tight mb-0.5 truncate">
        {header}
      </span>
      <span
        className={`font-semibold text-[9px] sm:text-[11px] leading-tight truncate ${valueClass}`}
        style={valueStyle}
        title={displayValue}
      >
        {pct != null && pct !== "" && (isBull || isBear) && (
          <span className="mr-0.5">{isBull ? "▲" : "▼"}</span>
        )}
        {displayValue}
      </span>
    </div>
  );
}

/** Compact EMA trend row from /api/pairstatus (supports multiple column name variants). */
export default function EmaTrendGrid({ emaTrends, className = "" }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!emaTrends) return;
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, [emaTrends]);

  if (!emaTrends) return null;

  const lastUpdated = pickField(emaTrends, ["last_updated", "Last_updated", "lastUpdated"]);
  const lastUpdatedDisplay = getTimeAgo(lastUpdated);

  return (
    <div
      className={`grid grid-cols-4 sm:grid-cols-7 xl:grid-cols-8 gap-1 sm:gap-1.5 flex-1 min-w-0 ${className}`.trim()}
    >
      <EmaCell header="Last Update" value={lastUpdatedDisplay ?? "—"} />
      {EMA_INTERVALS.map(({ label, trendKeys, pctKeys }) => (
        <EmaCell
          key={label}
          header={label}
          trendText={pickField(emaTrends, trendKeys)}
          pct={pickField(emaTrends, pctKeys)}
        />
      ))}
    </div>
  );
}
