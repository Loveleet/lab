import moment from "moment";

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

/** Closed hedge: explicit hedge_close, or direct close with hedge flag and loss. */
export function isHedgeClosedTrade(trade) {
  const type = getTradeType(trade);
  if (type === "hedge_close") return true;
  if (type === "close") {
    const hedgeValue = trade.hedge ?? trade.Hedge ?? trade.hedge_bool ?? trade.Hedge_bool;
    const pl = parseFloat(trade.pl_after_comm ?? trade.Pl_after_comm);
    return parseHedge(hedgeValue) && !Number.isNaN(pl) && pl < 0;
  }
  return false;
}

export function getTradeCloseMoment(trade) {
  const raw =
    trade?.created_at ??
    trade?.operator_close_time ??
    trade?.Operator_close_time ??
    trade?.close_time ??
    trade?.Close_time ??
    trade?.updated_at;
  if (!raw) return null;
  const m = moment(raw);
  return m.isValid() ? m : null;
}

/** Active single-day filter from Set Date or From/To on the same calendar day. */
export function resolveActiveViewDay(viewDay, fromDate, toDate) {
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

/**
 * Single-day view:
 * - Past days: only trades closed on that day.
 * - Today: all running-like trades + closed today.
 */
export function matchesSingleDayView(trade, viewDay) {
  if (!viewDay) return true;

  const dayStart = moment(viewDay).startOf("day");
  const dayEnd = moment(viewDay).endOf("day");
  const isToday = dayStart.isSame(moment(), "day");

  if (isClosedTradeType(trade)) {
    const closeTime = getTradeCloseMoment(trade);
    if (!closeTime) return false;
    return closeTime.isBetween(dayStart, dayEnd, null, "[]");
  }

  if (isRunningLikeTrade(trade)) {
    return isToday;
  }

  // Any other non-closed type on a past day is hidden
  if (!isToday) return false;

  const startRaw = trade?.candel_time ?? trade?.candle_time ?? trade?.Candle_time;
  if (!startRaw) return false;
  const start = moment(startRaw);
  if (!start.isValid()) return false;
  return start.isBetween(dayStart, dayEnd, null, "[]");
}
