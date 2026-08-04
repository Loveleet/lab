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

/** Closed hedge: explicit hedge_close, or direct close with hedge flag and loss. */
export function isHedgeClosedTrade(trade) {
  const type = String(trade?.type ?? "").toLowerCase();
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

/**
 * Single-day view (Set Date):
 * - Closed: match close timestamp on that day (not candle/start time).
 * - Running: only when selected day is today — show all running trades.
 */
export function matchesSingleDayView(trade, viewDay) {
  if (!viewDay) return true;
  const dayStart = moment(viewDay).startOf("day");
  const dayEnd = moment(viewDay).endOf("day");
  const isToday = dayStart.isSame(moment(), "day");
  const type = String(trade?.type ?? "").toLowerCase();

  if (type === "running" || type === "hedge_hold") {
    return isToday;
  }

  if (type === "close" || type === "hedge_close") {
    const closeTime = getTradeCloseMoment(trade);
    if (!closeTime) return false;
    return closeTime.isBetween(dayStart, dayEnd, null, "[]");
  }

  const startRaw = trade?.candel_time ?? trade?.candle_time;
  if (!startRaw) return false;
  const start = moment(startRaw);
  if (!start.isValid()) return false;
  return start.isBetween(dayStart, dayEnd, null, "[]");
}
