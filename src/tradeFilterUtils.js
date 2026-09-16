import moment from "moment";
import { getRobustSymbolOptional } from "./tradeSymbolUtils";

export const parseHedge = (hedgeValue) => {
  if (hedgeValue === true || hedgeValue === "true" || hedgeValue === 1 || hedgeValue === "1") return true;
  if (
    hedgeValue === false ||
    hedgeValue === "false" ||
    hedgeValue === 0 ||
    hedgeValue === "0" ||
    hedgeValue === null ||
    hedgeValue === undefined
  ) {
    return false;
  }
  if (typeof hedgeValue === "string") {
    const numValue = parseFloat(hedgeValue);
    return !Number.isNaN(numValue) && numValue > 0;
  }
  return false;
};

export function getTradeType(trade) {
  return String(trade?.type ?? trade?.Type ?? "").trim().toLowerCase();
}

export function isClosedTradeType(trade) {
  const type = getTradeType(trade);
  return type === "close" || type === "hedge_close";
}

/** Open / active trades — not closed. */
export function isRunningLikeTrade(trade) {
  const type = getTradeType(trade);
  return (
    type === "running" ||
    type === "hedge_hold" ||
    type === "assigned" ||
    type === "assign" ||
    type === "back_close"
  );
}

/** Closed hedge: any closed trade closed in minus (loss). */
export function getTradePl(trade) {
  const pl = parseFloat(trade?.pl_after_comm ?? trade?.Pl_after_comm);
  return Number.isNaN(pl) ? 0 : pl;
}

export function tradeClientId(trade) {
  try {
    const n = parseInt(trade?.client_id ?? trade?.clientId ?? 0, 10);
    return Number.isFinite(n) ? n : 0;
  } catch (_) {
    return 0;
  }
}

export function tradeClientName(trade) {
  const name = String(trade?.client_name || trade?.clientName || "").trim();
  const id = tradeClientId(trade);
  if (name) return name;
  if (id > 0) return `Client ${id}`;
  return "";
}

export function tradeVenue(trade) {
  const raw = String(trade?.exchange || trade?.Exchange || "binance").trim().toLowerCase();
  return raw === "delta" ? "delta" : "binance";
}

function positionAction(p) {
  const amt = parseFloat(p?.positionAmt ?? p?.size ?? 0);
  let side = String(p?.positionSide || "").toUpperCase();
  if (!side || side === "BOTH") {
    side = Number.isFinite(amt) && amt < 0 ? "SHORT" : "LONG";
  }
  if (side === "LONG" || side === "BUY") return "BUY";
  return "SELL";
}

function positionPl(p) {
  const n = parseFloat(p?.unRealizedProfit ?? p?.unrealized_pnl ?? p?.unrealizedPnl ?? p?.unrealized_cash_pnl);
  return Number.isFinite(n) ? n : null;
}

export function applyLivePlFromPositions(trades, positions) {
  if (!Array.isArray(trades) || !trades.length || !Array.isArray(positions) || !positions.length) {
    return trades;
  }
  const legs = [];
  for (const p of positions) {
    const sym = getRobustSymbolOptional(p?.symbol) || String(p?.symbol || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const pl = positionPl(p);
    if (!sym || pl == null) continue;
    const venue = String(p?.exchange || "binance").trim().toLowerCase() === "delta" ? "delta" : "binance";
    const cid = Number.isFinite(parseInt(p?.client_id, 10)) ? parseInt(p.client_id, 10) : 0;
    legs.push({ sym, action: positionAction(p), pl, venue, cid });
  }
  if (!legs.length) return trades;
  return trades.map((t) => {
    const type = String(t?.type || "");
    if (type !== "running" && type !== "hedge_hold") return t;
    const sym = getRobustSymbolOptional(t?.pair || t?.symbol) || String(t?.pair || t?.symbol || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const action = String(t?.action || "").toUpperCase();
    if (!sym || (action !== "BUY" && action !== "SELL")) return t;
    const venue = tradeVenue(t);
    const cid = tradeClientId(t);
    const sameSymAction = legs.filter((l) => l.sym === sym && l.action === action);
    if (!sameSymAction.length) return t;
    const exact = sameSymAction.filter((l) => l.cid === cid && l.venue === venue);
    const house = sameSymAction.filter((l) => l.cid === 0 && l.venue === venue);
    const venueOnly = sameSymAction.filter((l) => l.venue === venue);
    const pick = house[0] || exact[0] || venueOnly[0] || sameSymAction[0];
    return { ...t, pl_after_comm: pick.pl, Pl_after_comm: pick.pl };
  });
}

export function pythonAccountQuery(trade) {
  const params = new URLSearchParams();
  const cid = tradeClientId(trade);
  const venue = tradeVenue(trade);
  if (cid > 0) params.set("client_id", String(cid));
  if (venue) params.set("exchange", venue);
  const q = params.toString();
  return q ? `&${q}` : "";
}

export function overlayPositionKey(trade, symbol) {
  return `${tradeClientId(trade)}|${tradeVenue(trade)}|${symbol || ""}`;
}

export function isHedgeClosedTrade(trade) {
  return isClosedTradeType(trade) && getTradePl(trade) < 0;
}

/** Direct closed: any closed trade not in minus (profit or breakeven). */
export function isDirectClosedTrade(trade) {
  return isClosedTradeType(trade) && getTradePl(trade) >= 0;
}

export function getTradeCloseMoment(trade) {
  const raw =
    trade?.operator_close_time ??
    trade?.Operator_close_time ??
    trade?.close_time ??
    trade?.Close_time ??
    trade?.created_at ??
    trade?.updated_at;
  if (!raw) return null;
  const m = moment(raw);
  return m.isValid() ? m : null;
}

/** Active single-day filter from Set Date or From/To on the same calendar day. */
export function resolveActiveViewDay(viewDay, fromDate, toDate, dayViewActive = false) {
  if (dayViewActive) {
    if (viewDay && moment(viewDay).isValid()) return moment(viewDay).startOf("day");
    if (fromDate && moment(fromDate).isValid()) return moment(fromDate).startOf("day");
    return null;
  }
  if (viewDay && moment(viewDay).isValid()) {
    return moment(viewDay).startOf("day");
  }
  if (fromDate && toDate && moment(fromDate).isValid() && moment(toDate).isValid()) {
    const from = moment(fromDate).startOf("day");
    const to = moment(toDate).startOf("day");
    if (from.isSame(to, "day")) return from;
  }
  return null;
}

export function isViewDayToday(viewDay) {
  if (!viewDay || !moment(viewDay).isValid()) return false;
  return moment(viewDay).startOf("day").isSame(moment(), "day");
}

/**
 * Single-day view:
 * - Past days: ONLY trades closed on that day (by close timestamp).
 * - Today: all running-like + closed today.
 */
export function matchesSingleDayView(trade, viewDay) {
  if (!viewDay || !moment(viewDay).isValid()) return true;

  const dayStart = moment(viewDay).startOf("day");
  const dayEnd = moment(viewDay).endOf("day");
  const isToday = dayStart.isSame(moment(), "day");

  // Past days: nothing open/running — closed-on-that-day only
  if (!isToday) {
    if (!isClosedTradeType(trade)) return false;
    const closeTime = getTradeCloseMoment(trade);
    if (!closeTime) return false;
    return closeTime.isBetween(dayStart, dayEnd, null, "[]");
  }

  // Today: show all active/running trades
  if (isRunningLikeTrade(trade)) return true;

  if (isClosedTradeType(trade)) {
    const closeTime = getTradeCloseMoment(trade);
    if (!closeTime) return false;
    return closeTime.isBetween(dayStart, dayEnd, null, "[]");
  }

  const startRaw = trade?.candel_time ?? trade?.candle_time ?? trade?.Candle_time;
  if (!startRaw) return false;
  const start = moment(startRaw);
  if (!start.isValid()) return false;
  return start.isBetween(dayStart, dayEnd, null, "[]");
}
