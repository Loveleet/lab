/**
 * Closed trades strategy (matches intended plan):
 * 1. First visit: download closed in small pages → show UI after page 1 → save IndexedDB
 * 2. Refresh: show IndexedDB closed immediately + fetch running + tiny meta
 * 3. If meta in sync → skip closed download
 * 4. If DB ahead → fetch only newly closed (since_at)
 * Server keeps data/closed_trades.json in background; browser does not wait on the 18MB file.
 */

import { apiFetch } from "./config";

const RUNNING_TYPES = new Set(["running", "hedge_hold", "assigned", "assign"]);
const CLOSED_TYPES = new Set(["close", "hedge_close"]);

const IDB_NAME = "lab_trades_cache";
const IDB_VERSION = 1;
const IDB_STORE = "closed";
const IDB_KEY = "closed_v1";
const CLOSED_PAGE_SIZE = 800;

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

function splitTrades(trades) {
  const running = [];
  const closed = [];
  for (const t of trades || []) {
    if (isRunningTrade(t)) running.push(t);
    else if (isClosedTrade(t)) closed.push(t);
    else running.push(t);
  }
  return { running, closed };
}

function normalizeMetaTs(ts) {
  if (ts == null || ts === "") return null;
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? null : new Date(n).toISOString();
}

export function metaMatches(a, b) {
  if (!a || !b) return false;
  return (
    Number(a.closedCount) === Number(b.closedCount) &&
    normalizeMetaTs(a.lastClosedAt) === normalizeMetaTs(b.lastClosedAt)
  );
}

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

async function idbGet() {
  try {
    const db = await openIdb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function idbSet(payload) {
  try {
    const db = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(payload, IDB_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (e) {
    console.warn("[tradesCache] IndexedDB save failed:", e?.message || e);
    return false;
  }
}

async function idbClear() {
  try {
    const db = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (_) {}
}

export async function loadClosedFromLocalCache() {
  const row = await idbGet();
  if (!row || !Array.isArray(row.trades) || row.trades.length === 0) return null;
  return {
    trades: row.trades,
    meta: row.meta
      ? {
          closedCount: row.meta.closedCount ?? row.trades.length,
          lastClosedAt: normalizeMetaTs(row.meta.lastClosedAt),
          runningCount: row.meta.runningCount,
        }
      : null,
  };
}

async function saveClosedToLocalCache(meta, trades) {
  if (!meta || !Array.isArray(trades) || trades.length === 0) return;
  await idbSet({
    trades,
    meta: {
      closedCount: meta.closedCount ?? trades.length,
      lastClosedAt: normalizeMetaTs(meta.lastClosedAt),
      runningCount: meta.runningCount,
      savedAt: new Date().toISOString(),
    },
  });
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

async function fetchClosedIncremental(sinceAt, onProgress) {
  if (onProgress) {
    onProgress({ phase: "incremental", percent: 50, message: "Fetching newly closed trades…" });
  }
  const q = encodeURIComponent(sinceAt);
  const res = await apiFetch(`/api/trades/closed?since_at=${q}&limit=5000`);
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

async function fetchFileStatus() {
  const res = await apiFetch("/api/trades/closed/file/status");
  if (!res.ok) return null;
  return res.json();
}

/**
 * First-time closed load: pages of ~800 (not the 18MB file).
 * Calls onPage after every page so the grid can show closed immediately.
 */
async function fetchClosedPaged({ onProgress, onPage } = {}) {
  let page = 1;
  let all = [];
  let closedCount = null;
  let lastClosedAt = null;

  // Kick server file sync in background (do not await body)
  fetchFileStatus().catch(() => {});

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

  // Best-effort lastClosedAt from meta endpoint if not in page response
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
      message: `Closed loaded (${all.length}) — cached for next refresh`,
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

export async function flushClosedCache() {
  const res = await apiFetch("/api/trades/closed/file/flush", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `flush failed HTTP ${res.status}`);
  }
  await idbClear();
  return true;
}

export async function getClosedCacheStats() {
  const local = await loadClosedFromLocalCache();
  const status = await fetchFileStatus().catch(() => null);
  return {
    cachedClosedCount: local?.trades?.length ?? status?.fileCount ?? 0,
    closedCount: local?.meta?.closedCount ?? status?.fileMeta?.closedCount ?? status?.fileCount ?? 0,
    runningCount: local?.meta?.runningCount,
    lastClosedAt: local?.meta?.lastClosedAt ?? status?.fileMeta?.lastClosedAt ?? null,
    lastSyncAt: status?.fileMeta?.lastSyncAt ?? null,
    fromFile: true,
    fromIndexedDb: !!local,
    filePath: status?.filePath ?? "data/closed_trades.json",
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
  const { running, closed } = splitTrades(trades);
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

  // ── 1. Local closed first ──
  let closed = Array.isArray(cachedClosed) && cachedClosed.length ? cachedClosed : [];
  let metaForCompare = cachedMeta || null;

  if (!closed.length || !metaForCompare) {
    const local = await loadClosedFromLocalCache();
    if (local?.trades?.length) {
      closed = local.trades;
      metaForCompare = local.meta || metaForCompare;
    }
  }

  if (closed.length && onEarlyData) {
    onEarlyData(closed, metaForCompare);
  }

  if (onProgress) {
    onProgress({
      phase: "running",
      percent: closed.length ? 20 : 0,
      message: closed.length
        ? `Showing ${closed.length} cached closed — fetching running…`
        : "Fetching running trades…",
    });
  }

  // ── 2. Small network: running + meta ──
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

  if (onProgress) {
    onProgress({
      phase: "running",
      downloaded: running.length,
      total: running.length,
      percent: 60,
      message: `${running.length} running · checking closed sync…`,
    });
  }

  if (forceFullClosed) {
    await flushClosedCache();
    closed = [];
    metaForCompare = null;
  }

  let closedSkipped = false;
  let closedMode = "cache";

  if (
    !forceFullClosed &&
    metaSnapshot &&
    metaForCompare &&
    closed.length > 0 &&
    metaMatches(metaForCompare, metaSnapshot)
  ) {
    closedSkipped = true;
    closedMode = "cache";
    if (onProgress) {
      onProgress({
        phase: "cache",
        percent: 100,
        message: `Closed in sync (${closed.length}) — skipped download`,
      });
    }
  } else if (
    !forceFullClosed &&
    metaSnapshot &&
    metaForCompare &&
    closed.length > 0 &&
    metaForCompare.lastClosedAt &&
    (metaSnapshot.closedCount !== metaForCompare.closedCount ||
      normalizeMetaTs(metaSnapshot.lastClosedAt) !== normalizeMetaTs(metaForCompare.lastClosedAt))
  ) {
    closedMode = "incremental";
    const incResult = await fetchClosedIncremental(metaForCompare.lastClosedAt, onProgress);
    if (incResult.authRequired) return { authRequired: true, trades: [] };
    closed = mergeClosedRows(closed, incResult.trades);
    // Tell server to append the same new closes into its JSONL (background)
    fetchFileStatus().catch(() => {});
  } else if (!closed.length || forceFullClosed) {
    // First time: paged download (shows after first page) — never the 18MB file
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
  } else {
    closedSkipped = true;
    closedMode = "cache";
    if (onProgress) {
      onProgress({
        phase: "cache",
        percent: 100,
        message: `Using cached closed (${closed.length})`,
      });
    }
  }

  const trades = mergeRunningAndClosed(running, closed);
  const finalMeta = metaSnapshot || metaForCompare || {
    closedCount: closed.length,
    lastClosedAt: null,
    runningCount: running.length,
  };

  if (finalMeta && closed.length > 0) {
    // Don't block UI paint on IndexedDB write
    saveClosedToLocalCache(
      { ...finalMeta, runningCount: running.length },
      closed
    ).catch(() => {});
  }

  console.log(
    "[tradesCache]",
    running.length,
    "running +",
    closed.length,
    "closed",
    `(${closedMode}${closedSkipped ? ", skipped net" : ""})`,
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
      fromFile: closedMode === "paged",
      closedSkipped,
      closedMode,
    },
  };
}
