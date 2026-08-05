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

/** Closed hedge: any closed trade closed in minus (loss). */
export function getTradePl(trade) {
  const pl = parseFloat(trade?.pl_after_comm ?? trade?.Pl_after_comm);
  return Number.isNaN(pl) ? 0 : pl;
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
