/** Cloud API (direct IP). Used when not on localhost and not GitHub Pages. */
const CLOUD_API = "http://167.104.222.209:10000";
/** HTTPS API for GitHub Pages / clubinfotech.com (mixed-content blocks raw http:// IP). */
const CLOUD_API_HTTPS = "https://api.clubinfotech.com";
const CLOUD_HOSTS = ["167.104.222.209"];
const PAGES_HOSTS = ["clubinfotech.com", "www.clubinfotech.com"];

/** Local API (Node server). Vite dev server proxies /api to this. */
const LOCAL_API_PORT = 10000;
const LOCAL_API = `http://localhost:${LOCAL_API_PORT}`;

/** Set by runtime config (api-config.json) when loaded — fixed API URL (cloud IP or domain), not tunnel */
let runtimeApiBaseUrl = null;
let loggedEmptyOnce = false;
let fetchLoggedOnce = false;

/** When true, localhost uses cloud API instead of local (used after "Use cloud data" when local server is down). */
let localhostUseCloudFallback = false;

/** True when app is running in browser on localhost (dev). */
function isLocalhostOrigin() {
  if (typeof window === "undefined") return false;
  const h = window.location?.hostname || "";
  return h === "localhost" || h === "127.0.0.1";
}

/** GitHub Pages (github.io or custom domain). Must use the HTTPS API host, not relative /api. */
function isGitHubPagesOrigin() {
  if (typeof window === "undefined") return false;
  const h = (window.location?.hostname || "").toLowerCase();
  return h.includes("github.io") || PAGES_HOSTS.includes(h);
}

/** HTTPS pages cannot call http://IP — browsers block mixed content. */
function httpsSafeApiUrl(url) {
  if (!url || typeof url !== "string") return url;
  const u = url.trim().replace(/\/+$/, "");
  if (!u) return u;
  if (typeof window !== "undefined" && window.location?.protocol === "https:" && u.startsWith("http://")) {
    return CLOUD_API_HTTPS;
  }
  return u;
}

/**
 * Build-time default (env or cloud IP). On HTTPS we never use raw IP (no valid cert → ERR_SSL_PROTOCOL_ERROR).
 * Localhost: use relative URLs so Vite proxy forwards /api to localhost:10000 (or use env override).
 * GitHub Pages: build secret VITE_API_BASE_URL or runtime api-config.json (fixed cloud URL).
 * Other: cloud API.
 */
function getBuildTimeDefault() {
  let base = import.meta.env.VITE_API_BASE_URL;
  if (base !== undefined && base !== "") {
    return httpsSafeApiUrl(base);
  }
  // LOCALHOST: use empty base so fetch("/api/...") goes to same origin → Vite proxy → localhost:10000
  // Unless user chose "Use cloud data" after local server was down
  if (typeof window !== "undefined" && isLocalhostOrigin()) {
    if (localhostUseCloudFallback) return CLOUD_API;
    return ""; // Relative URLs; Vite proxy in vite.config.js forwards /api to http://localhost:10000
  }
  // Cloud server: same-origin
  if (typeof window !== "undefined" && window.location?.origin) {
    const o = window.location.origin;
    if (CLOUD_HOSTS.some((h) => o.startsWith("http://" + h)) || o.startsWith("https://localhost")) return "";
  }
  // Production on HTTPS (GitHub Pages / clubinfotech.com): HTTPS API host immediately
  if (typeof window !== "undefined" && window.location?.protocol === "https:") return CLOUD_API_HTTPS;
  // Dev build but not in browser on localhost, or production on HTTP: use cloud
  return CLOUD_API;
}

/** When true, we are on the cloud server — always use same-origin API */
function isCloudServerOrigin() {
  if (typeof window === "undefined") return false;
  const h = window.location?.hostname || "";
  return CLOUD_HOSTS.includes(h);
}

/** Ensure API base has a protocol so fetch() uses it as absolute URL, not relative to GitHub Pages. */
function ensureProtocol(url) {
  if (!url || typeof url !== "string") return url;
  const u = url.trim().replace(/\/+$/, "");
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return "https://" + u;
}

function getApiBaseUrl() {
  // When served from cloud server, always use same origin so /api/* hits this server (real olab data)
  if (isCloudServerOrigin()) return "";
  
  // Prefer runtime api-config.json (fixed cloud URL) if loaded
  if (runtimeApiBaseUrl) return httpsSafeApiUrl(ensureProtocol(runtimeApiBaseUrl));
  return httpsSafeApiUrl(ensureProtocol(getBuildTimeDefault()));
}

/** Load API URL from api-config.json once (fixed cloud IP or domain). No tunnel; no periodic refetch. */
function loadRuntimeApiConfig() {
  if (typeof window === "undefined") return Promise.resolve();
  if (isCloudServerOrigin()) return Promise.resolve();
  const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  const basePath = base === "./" || base === "." ? "" : (base.replace(/\/$/, "") || "");
  const path = (basePath ? basePath + "/" : "") + "api-config.json";
  const url = new URL(path, window.location.origin).href;
  const fetchUrl = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
  if (isGitHubPagesOrigin() && !fetchLoggedOnce) {
    fetchLoggedOnce = true;
    console.log("[LAB] Fetching api-config.json:", url);
  }
  return fetch(fetchUrl)
    .then((res) => {
      if (isGitHubPagesOrigin() && !res.ok) {
        console.error(`[LAB] api-config.json not found (${res.status}). Set API_BASE_URL secret and run Deploy frontend to GitHub Pages.`);
        if (res.status === 404 && basePath) {
          const rootUrl = new URL("api-config.json", window.location.origin).href;
          return fetch(rootUrl + "?t=" + Date.now()).catch(() => res);
        }
      }
      return res.ok ? res.json() : null;
    })
    .then((j) => {
      if (!j) return;
      const raw = typeof j.apiBaseUrl === "string" ? j.apiBaseUrl : (typeof j.tunnelUrl === "string" ? j.tunnelUrl : "");
      const apiUrl = httpsSafeApiUrl(raw.replace(/\/$/, "").trim());
      if (apiUrl) {
        const oldUrl = runtimeApiBaseUrl;
        runtimeApiBaseUrl = apiUrl;
        if (isGitHubPagesOrigin()) {
          console.log("[LAB] API base from api-config.json:", apiUrl);
        }
        if (oldUrl !== apiUrl || !oldUrl) {
          window.dispatchEvent(new CustomEvent("api-config-loaded"));
        }
      } else if (isGitHubPagesOrigin() && !loggedEmptyOnce) {
        loggedEmptyOnce = true;
        console.warn("[LAB] api-config.json has empty apiBaseUrl. Set API_BASE_URL to https://api.clubinfotech.com and run Deploy frontend to GitHub Pages.");
      }
    })
    .catch((err) => {
      if (isGitHubPagesOrigin()) {
        console.error("[LAB] api-config.json fetch failed:", err.message);
      }
    });
}

if (typeof window !== "undefined") {
  loadRuntimeApiConfig();
}

/** Initial value; use getApiBaseUrl() for current value (updates after api-config.json loads once). */
export const API_BASE_URL = typeof window !== "undefined" ? getApiBaseUrl() : "";

if (typeof window !== "undefined" && isGitHubPagesOrigin()) {
  console.log("[LAB] Page URL:", window.location.href);
  if (!API_BASE_URL && !runtimeApiBaseUrl) {
    console.log("[LAB] Set API_BASE_URL secret to https://api.clubinfotech.com and run Deploy frontend to GitHub Pages.");
  }
}

export function setLocalhostUseCloudFallback(value) {
  localhostUseCloudFallback = !!value;
}
export function getLocalhostUseCloudFallback() {
  return localhostUseCloudFallback;
}

export { getApiBaseUrl, loadRuntimeApiConfig, isLocalhostOrigin, isGitHubPagesOrigin };

/** Check if runtime api-config.json has loaded (for debugging) */
export function hasRuntimeApiConfig() {
  return !!runtimeApiBaseUrl;
}

export function api(path) {
  const base = getApiBaseUrl();
  if (!base) {
    if (isGitHubPagesOrigin()) {
      console.warn("[api()] No API base URL — set API_BASE_URL and redeploy, or wait for api-config.json");
    }
    return path; // Relative path (same origin)
  }
  const fullUrl = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  if (isGitHubPagesOrigin()) {
    console.log(`[api()] Built URL: ${fullUrl} (base: ${base}, path: ${path})`);
  }
  return fullUrl;
}

/** Fetch with credentials so session cookie is sent. Use for all API calls that require auth.
 * On 401, dispatches 'lab-unauthorized' so the app can redirect to login. */
export function apiFetch(pathOrUrl, opts = {}) {
  const url = typeof pathOrUrl === "string" && pathOrUrl.startsWith("http") ? pathOrUrl : api(pathOrUrl);
  return fetch(url, { ...opts, credentials: "include" }).then((res) => {
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lab-unauthorized"));
    }
    return res;
  });
}

/** Base URL for the signals API (api_signals.py). On localhost we call local Python (5001); otherwise same as main API. */
function getSignalsApiBaseUrl() {
  if (typeof window !== "undefined" && (window.location?.hostname === "localhost" || window.location?.hostname === "127.0.0.1")) {
    const env = import.meta.env.VITE_SIGNALS_API_BASE_URL;
    if (env !== undefined && env !== "") return env.replace(/\/$/, "");
    return "http://localhost:5001";
  }
  return getApiBaseUrl();
}

export function apiSignals(path) {
  const base = getSignalsApiBaseUrl();
  return base ? `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}` : path;
}

/** Fetch signals API. Uses omit credentials so Python CORS (*) works; Python has no auth. */
export function apiSignalsFetch(pathOrUrl, opts = {}) {
  const url = typeof pathOrUrl === "string" && pathOrUrl.startsWith("http") ? pathOrUrl : apiSignals(pathOrUrl);
  return fetch(url, { ...opts, credentials: "omit" });
}

function isLocalDevHost() {
  return typeof window !== "undefined" && (window.location?.hostname === "localhost" || window.location?.hostname === "127.0.0.1");
}

/** Python-backed endpoints: try local Python on localhost, else Node proxy (cloud dev or production). */
export async function fetchPythonApi(path, opts = {}) {
  if (isLocalDevHost()) {
    try {
      const direct = await apiSignalsFetch(path, opts);
      if (direct.ok) return direct;
      if (direct.status > 0 && direct.status !== 502 && direct.status !== 503) return direct;
    } catch (_) {
      // local Python not running — fall through to Node proxy
    }
  }
  return apiFetch(api(path), opts);
}
