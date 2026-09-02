/** Strip HTML/whitespace and keep Unicode ticker chars (e.g. 龙虾USDT). */
export function cleanTradingSymbol(raw) {
  if (raw == null || raw === "") return "";
  let s = String(raw).replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  if (/^binance/i.test(s)) s = s.replace(/^binance/i, "");
  s = s.replace(/PERPETUALCONTRACT|PERP|CHART/gi, "");
  s = s.replace(/\d{4}-\d{2}-\d{2}[T\s].*$/, "");
  s = s.replace(/\d{6,}$/, "");
  s = s.replace(/[^\p{L}\p{N}]/gu, "");
  s = s.replace(/[a-z]/g, (c) => c.toUpperCase());
  return s;
}

/** Normalize pair/symbol for Binance API calls. */
export function getRobustSymbol(pair, fallback = "BTCUSDT") {
  const cleaned = cleanTradingSymbol(pair);
  return cleaned || fallback;
}

export function getRobustSymbolOptional(pair) {
  return cleanTradingSymbol(pair);
}

/** Extract trading pair from unique_id like "龙虾USDTBUY2026-09-02...". */
export function getSymbolFromUniqueId(uid) {
  if (!uid || typeof uid !== "string") return "";
  const upper = uid.toUpperCase();
  const buy = upper.indexOf("BUY");
  const sell = upper.indexOf("SELL");
  let end = -1;
  if (buy >= 0 && sell >= 0) end = Math.min(buy, sell);
  else if (buy >= 0) end = buy;
  else if (sell >= 0) end = sell;
  if (end > 0) return cleanTradingSymbol(uid.slice(0, end));
  return "";
}

/** Normalize any symbol string before sending to API (preserves Unicode tickers). */
export function normalizeSymbolForApi(symbol) {
  return cleanTradingSymbol(symbol);
}
