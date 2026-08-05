/**
 * Closed trades: canonical copy lives on the cloud server (data/closed_trades.jsonl).
 * Browser keeps closed rows in memory for the current session only — no IndexedDB.
 * Refresh: running + meta + sync server file + fetch any missing closed rows from DB.
 */

import { apiFetch } from "./config";

const RUNNING_TYPES = new Set(["running", "hedge_hold", "assigned", "assign"]);
const CLOSED_TYPES = new Set(["close", "hedge_close"]);
const CLOSED_PAGE_SIZE = 800;
const SESSION_META_KEY = "lab_closed_meta_v2";

export function tradeRowKey(t) {
  const uid = t?.unique_id ?? t?.Unique_ID ?? t?.uid;
  if (uid != null && String(uid).trim()) return String(uid).trim();
  return [
    t?.pair ?? "",
    t?.machineid ?? "",
    t?.candel_time ?? t?.candle_time ?? "",
    t?.type ?? "",
    t?.action ?? "",
  ].join("|");
}

export function isRunningTrade(t) {
  return RUNNING_TYPES.has(String(t?.type ?? ""));
}

export function isClosedTrade(t) {
  return CLOSED_TYPES.has(String(t?.type ?? ""));
}

export function mergeRunningAndClosed(running, closed) {
  const map = new Map();
  for (const t of closed) map.set(tradeRowKey(t), t);
  for (const t of running) map.set(tradeRowKey(t), t);
  return [...map.values()];
}

function mergeClosedRows(existing, incoming) {
  const map = new Map();
  for (const t of existing) map.set(tradeRowKey(t), t);
  for (const t of incoming) map.set(tradeRowKey(t), t);
  return [...map.values()];
}

function normalizeMetaTs(ts) {
  if (ts == null || ts === "") return null;
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? null : new Date(n).toISOString();
}

function loadSessionMeta() {
  try {
    const raw = sessionStorage.getItem(SESSION_META_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return m?.closedCount != null
      ? {
          closedCount: m.closedCount,
          lastClosedAt: normalizeMetaTs(m.lastClosedAt),
          runningCount: m.runningCount,
        }
      : null;
  } catch {
    return null;
  }
}

function saveSessionMeta(meta) {
  if (!meta) return;
  try {
    sessionStorage.setItem(
      SESSION_META_KEY,
      JSON.stringify({
        closedCount: meta.closedCount,
        lastClosedAt: normalizeMetaTs(meta.lastClosedAt),
        runningCount: meta.runningCount,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (_) {}
}

function clearSessionMeta() {
  try {
    sessionStorage.removeItem(SESSION_META_KEY);
  } catch (_) {}
}

/** @deprecated No browser trade cache — returns null. Meta-only via sessionStorage internally. */
export async function loadClosedFromLocalCache() {
  return null;
}

async function fetchTradesMeta() {
  const res = await apiFetch("/api/trades/meta");
  if (!res.ok) return null;
  const json = await res.json();
  return {
    runningCount: json.runningCount ?? 0,
    closedCount: json.closedCount ?? 0,
    lastClosedAt: normalizeMetaTs(json.lastClosedAt),
    totalCount: json.totalCount ?? 0,
  };
}

async function fetchRunningTrades() {
  const res = await apiFetch("/api/trades/running");
  if (res.status === 401) return { authRequired: true, trades: [] };
  if (!res.ok) throw new Error(`running trades HTTP ${res.status}`);
  const json = await res.json();
  return { authRequired: false, trades: Array.isArray(json.trades) ? json.trades : [] };
}

async function syncServerClosedFile() {
  try {
    const res = await apiFetch("/api/trades/closed/file/sync", { method: "POST" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchFileStatus() {
  const res = await apiFetch("/api/trades/closed/file/status");
  if (!res.ok) return null;
  return res.json();
}

async function fetchClosedIncremental(sinceAt, onProgress) {
  if (onProgress) {
    onProgress({ phase: "incremental", percent: 50, message: "Fetching newly closed trades…" });
  }
  const q = encodeURIComponent(sinceAt);
  const res = await apiFetch(`/api/trades/closed?since_at=${q}&limit=5000&inclusive=1`);
  if (res.status === 401) return { authRequired: true, trades: [] };
  if (!res.ok) throw new Error(`incremental closed HTTP ${res.status}`);
  const json = await res.json();
  const trades = Array.isArray(json.trades) ? json.trades : [];
  if (onProgress) {
    onProgress({
      phase: "incremental",
      downloaded: trades.length,
      total: trades.length,
      percent: 100,
      message: trades.length ? `Added ${trades.length} newly closed trade(s)` : "No new closed trades",
    });
  }
  return { authRequired: false, trades };
}

async function fetchClosedTail(limit, onProgress) {
  if (onProgress) {
    onProgress({ phase: "gap-fill", percent: 70, message: "Filling missing closed trades…" });
  }
  const res = await apiFetch(`/api/trades/closed?tail=${Math.min(limit, 5000)}`);
  if (res.status === 401) return { authRequired: true, trades: [] };
  if (!res.ok) throw new Error(`tail closed HTTP ${res.status}`);
  const json = await res.json();
  const trades = Array.isArray(json.trades) ? json.trades : [];
  if (onProgress) {
    onProgress({
      phase: "gap-fill",
      downloaded: trades.length,
      total: trades.length,
      percent: 100,
      message: trades.length ? `Gap-filled ${trades.length} closed trade(s)` : "No gap to fill",
    });
  }
  return { authRequired: false, trades };
}

async function fetchClosedPaged({ onProgress, onPage } = {}) {
  let page = 1;
  let all = [];
  let closedCount = null;
  let lastClosedAt = null;

  while (true) {
    const res = await apiFetch(`/api/trades/closed?page=${page}&limit=${CLOSED_PAGE_SIZE}`);
    if (res.status === 401) return { authRequired: true, trades: [], meta: null };
    if (!res.ok) throw new Error(`closed page HTTP ${res.status}`);
    const json = await res.json();
    const batch = Array.isArray(json.trades) ? json.trades : [];
    closedCount = json._meta?.closedCount ?? closedCount;
    const totalPages = json._meta?.totalPages ?? null;

    all = all.concat(batch);

    if (onPage) onPage(all, { closedCount, page, totalPages });
    if (onProgress) {
      const total = closedCount || all.length;
      const percent = total ? Math.min(99, Math.round((all.length / total) * 100)) : 0;
      onProgress({
        phase: "download",
        downloaded: all.length,
        total,
        percent,
        message: `Loading closed… ${all.length}/${total || "?"}`,
      });
    }

    if (batch.length < CLOSED_PAGE_SIZE) break;
    if (closedCount != null && all.length >= closedCount) break;
    if (totalPages != null && page >= totalPages) break;
    page += 1;
  }

  if (closedCount != null) {
    const meta = await fetchTradesMeta();
    lastClosedAt = meta?.lastClosedAt ?? null;
    closedCount = meta?.closedCount ?? closedCount;
  }

  if (onProgress) {
    onProgress({
      phase: "download",
      downloaded: all.length,
      total: all.length,
      percent: 100,
      message: `Closed loaded (${all.length}) from server`,
    });
  }

  return {
    authRequired: false,
    trades: all,
    meta: {
      closedCount: closedCount ?? all.length,
      lastClosedAt,
    },
  };
}

async function gapFillClosed(closed, dbMeta, onProgress) {
  if (!dbMeta || closed.length >= dbMeta.closedCount) return closed;
  const gap = dbMeta.closedCount - closed.length;
  const tailResult = await fetchClosedTail(gap + 150, onProgress);
  if (tailResult.authRequired) return closed;
  return mergeClosedRows(closed, tailResult.trades);
}

export async function flushClosedCache() {
  const res = await apiFetch("/api/trades/closed/file/flush", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `flush failed HTTP ${res.status}`);
  }
  clearSessionMeta();
  return true;
}

export async function getClosedCacheStats() {
  const status = await fetchFileStatus().catch(() => null);
  return {
    cachedClosedCount: status?.fileLineCount ?? status?.fileCount ?? 0,
    closedCount: status?.dbMeta?.closedCount ?? status?.fileMeta?.closedCount ?? 0,
    runningCount: status?.dbMeta?.runningCount,
    lastClosedAt: status?.fileMeta?.lastClosedAt ?? status?.dbMeta?.lastClosedAt ?? null,
    lastSyncAt: status?.fileMeta?.lastSyncAt ?? null,
    fromFile: true,
    fromIndexedDb: false,
    filePath: status?.filePath ?? "data/closed_trades.jsonl",
  };
}

async function fetchLegacyAllTrades(onProgress) {
  if (onProgress) {
    onProgress({ phase: "legacy", percent: 0, message: "Full download (legacy API)…" });
  }
  const res = await apiFetch("/api/trades");
  if (res.status === 401) return { authRequired: true, trades: [] };
  if (!res.ok) throw new Error(`trades HTTP ${res.status}`);
  const json = await res.json();
  const trades = Array.isArray(json.trades) ? json.trades : [];
  const running = trades.filter(isRunningTrade);
  const closed = trades.filter(isClosedTrade);
  if (onProgress) {
    onProgress({ phase: "legacy", downloaded: trades.length, total: trades.length, percent: 100 });
  }
  return {
    authRequired: false,
    trades,
    running,
    closed,
    legacy: true,
    demoHint: json._meta?.demoData ? json._meta.hint || null : null,
    stats: { runningCount: running.length, closedCount: closed.length, fromFile: false },
    meta: null,
  };
}

async function splitApiAvailable() {
  const res = await apiFetch("/api/trades/meta");
  if (res.ok) return true;
  const run = await apiFetch("/api/trades/running");
  return run.ok;
}

export async function fetchTradesSmart({
  onProgress,
  onRunning,
  onEarlyData,
  onClosedPage,
  forceFullClosed = false,
  cachedClosed = null,
  cachedMeta = null,
} = {}) {
  const splitOk = await splitApiAvailable();
  if (!splitOk) {
    console.warn("[tradesCache] Split/file API unavailable — legacy full fetch");
    return fetchLegacyAllTrades(onProgress);
  }

  let closed = Array.isArray(cachedClosed) && cachedClosed.length ? cachedClosed : [];
  let metaForCompare = cachedMeta || loadSessionMeta();

  if (closed.length && onEarlyData) {
    onEarlyData(closed, metaForCompare);
  }

  if (onProgress) {
    onProgress({
      phase: "running",
      percent: closed.length ? 20 : 0,
      message: closed.length
        ? `Showing ${closed.length} closed (session) — fetching running…`
        : "Fetching running trades…",
    });
  }

  // Sync cloud JSONL file first so all users share one canonical closed file
  if (onProgress) {
    onProgress({ phase: "sync", percent: 10, message: "Syncing cloud closed file…" });
  }
  await syncServerClosedFile();

  const [runningResult, dbMeta] = await Promise.all([fetchRunningTrades(), fetchTradesMeta()]);

  if (runningResult.authRequired) {
    return { authRequired: true, trades: [] };
  }
  const running = runningResult.trades;

  let metaSnapshot = dbMeta
    ? {
        runningCount: dbMeta.runningCount,
        closedCount: dbMeta.closedCount,
        lastClosedAt: dbMeta.lastClosedAt,
      }
    : null;

  if (onRunning) onRunning(running, closed);

  if (forceFullClosed) {
    await flushClosedCache();
    closed = [];
    metaForCompare = null;
  }

  const dbCount = metaSnapshot?.closedCount ?? 0;
  const needsClosedSync = !forceFullClosed && metaSnapshot && closed.length < dbCount;

  let closedMode = "session";

  if (needsClosedSync && closed.length > 0) {
    closedMode = "incremental";
    const sinceAt = metaForCompare?.lastClosedAt || closed.reduce((max, t) => {
      const ts = t.created_at || t.operator_close_time || t.candel_time;
      if (!ts) return max;
      const n = new Date(ts).getTime();
      return !max || n > new Date(max).getTime() ? new Date(ts).toISOString() : max;
    }, null);

    if (sinceAt) {
      const incResult = await fetchClosedIncremental(sinceAt, onProgress);
      if (incResult.authRequired) return { authRequired: true, trades: [] };
      closed = mergeClosedRows(closed, incResult.trades);
    }
    closed = await gapFillClosed(closed, metaSnapshot, onProgress);
    closedMode = closed.length >= dbCount ? "incremental+gap" : "gap-fill";
  } else if (!closed.length || forceFullClosed) {
    closedMode = "paged";
    const closedResult = await fetchClosedPaged({
      onProgress,
      onPage: (partial, info) => {
        if (onClosedPage) onClosedPage(partial, running, info);
      },
    });
    if (closedResult.authRequired) return { authRequired: true, trades: [] };
    closed = closedResult.trades;
    if (closedResult.meta?.lastClosedAt && metaSnapshot) {
      metaSnapshot.lastClosedAt = closedResult.meta.lastClosedAt;
      metaSnapshot.closedCount = closedResult.meta.closedCount ?? metaSnapshot.closedCount;
    }
  } else if (needsClosedSync) {
    closed = await gapFillClosed(closed, metaSnapshot, onProgress);
    closedMode = "gap-fill";
  } else if (onProgress) {
    onProgress({
      phase: "cache",
      percent: 100,
      message: `Closed in sync (${closed.length}) — cloud file`,
    });
  }

  // Final safety: always gap-fill if still short vs DB
  if (metaSnapshot && closed.length < metaSnapshot.closedCount) {
    closed = await gapFillClosed(closed, metaSnapshot, onProgress);
    closedMode = "gap-fill-final";
  }

  const trades = mergeRunningAndClosed(running, closed);
  const finalMeta = metaSnapshot || metaForCompare || {
    closedCount: closed.length,
    lastClosedAt: null,
    runningCount: running.length,
  };

  saveSessionMeta({ ...finalMeta, runningCount: running.length });

  console.log(
    "[tradesCache]",
    running.length,
    "running +",
    closed.length,
    "closed",
    `(${closedMode}, db=${dbCount})`,
    "=",
    trades.length,
    "total"
  );

  return {
    authRequired: false,
    trades,
    running,
    closed,
    legacy: false,
    demoHint: null,
    meta: finalMeta,
    stats: {
      runningCount: running.length,
      closedCount: closed.length,
      fromFile: true,
      closedSkipped: !needsClosedSync && closed.length >= dbCount,
      closedMode,
    },
  };
}
