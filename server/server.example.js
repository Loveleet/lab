/**
 * Backend template — no credentials. On the cloud this file is deployed as server.js.
 * The Node.js server runs on your cloud only (no Render, no Vercel). DB and other secrets
 * live only in /etc/lab-trading-dashboard.env on the server (never in Git).
 */

// Load env from file so cloud can use DATABASE_URL (systemd may also set EnvironmentFile)
(function loadEnvFile() {
  const fs = require("fs");
  const path = require("path");
  const tryLoad = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    try {
      const content = fs.readFileSync(filePath, "utf8");
      content.split("\n").forEach((line) => {
        const raw = line.trim();
        if (!raw || raw.startsWith("#")) return;
        const eq = raw.indexOf("=");
        if (eq <= 0) return;
        const key = raw.slice(0, eq).trim();
        let val = raw.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        } else {
          const comment = val.indexOf("#");
          if (comment >= 0) val = val.slice(0, comment).trim();
        }
        if (key) process.env[key] = val;
      });
      console.log("[env] Loaded", filePath);
    } catch (e) {
      console.warn("[env] Could not load", filePath, e.message);
    }
  };
  tryLoad(path.join(process.cwd(), ".env"));
  tryLoad(path.join(process.cwd(), "secrets.env"));
  tryLoad(path.join(process.cwd(), "..", ".env"));
  tryLoad(path.join(process.cwd(), "..", "secrets.env"));
  tryLoad("/etc/lab-trading-dashboard.env");
  tryLoad(process.env.SECRETS_FILE || "");
  tryLoad("/etc/lab-trading-dashboard.secrets.env");
  if (process.env.DATABASE_URL) {
    console.log("[env] DATABASE_URL is set — app will use remote DB when connection succeeds");
  } else {
    console.log("[env] DATABASE_URL not set — app will use local DB (DB_HOST/DB_*)");
  }
})();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");
const axios = require('axios');
const { spawn } = require("child_process");
const zlib = require("zlib");
const crypto = require("crypto");

const app = express();
const fs = require("fs");
const path = require("path");

// Gzip JSON/API responses (closed file is ~18MB uncompressed — critical for speed)
app.use((req, res, next) => {
  const accept = String(req.headers["accept-encoding"] || "");
  if (!accept.includes("gzip")) return next();
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    try {
      const raw = Buffer.from(JSON.stringify(body));
      if (raw.length < 1024) return originalJson(body);
      const gz = zlib.gzipSync(raw, { level: 6 });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");
      return res.send(gz);
    } catch {
      return originalJson(body);
    }
  };
  next();
});

const SEP = "────────────────────────────────────────────────────────────";
function log(msg, level = "INFO") {
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] [${level}] ${msg}\n${SEP}`);
}
function sendTelegramSync(message) {
  const py = path.join(__dirname, "..", "python", "send_telegram_cli.py");
  try {
    const proc = spawn(process.platform === "win32" ? "python" : "python3", [py, message], {
      cwd: path.join(__dirname, "..", "python"),
      stdio: "ignore",
    });
    proc.on("error", (e) => log(`Telegram send failed: ${e.message}`, "ERROR"));
  } catch (e) {
    log(`Telegram send failed: ${e.message}`, "ERROR");
  }
}
let currentLogPath = "D:/Projects/blockchainProject/pythonProject/Binance/Loveleet_Anish_Bot/LAB-New-Logic/hedge_logs";
const PORT = process.env.PORT || 10000;
const ENABLE_SELF_PING = String(process.env.ENABLE_SELF_PING || '').toLowerCase() === 'true';
const VERBOSE_LOG = String(process.env.VERBOSE_LOG || '').toLowerCase() === 'true';

// ✅ Allowed Frontend Origins (local + cloud + GitHub Pages / Vercel when frontend is hosted there)
const extraOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:10000",
  "http://150.241.244.130:10000", // Cloud (when frontend is served from same server)
  "https://loveleet.github.io",   // GitHub Pages (frontend hosted by GitHub)
  "https://lab-anish.vercel.app",
  ...extraOrigins,
];

// ✅ Proper CORS Handling
app.use(cors({
  origin: function (origin, callback) {
    try {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.error("❌ CORS blocked origin:", origin);
      return callback(new Error("CORS not allowed for this origin"));
    } catch (e) {
      console.error("❌ CORS origin parse error:", e.message);
      return callback(new Error("CORS origin parse error"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

app.use(express.json());
app.use(cookieParser());

app.post("/api/set-log-path", (req, res) => {
  const { path } = req.body;
  if (fs.existsSync(path)) {
    currentLogPath = path;
    console.log("✅ Log path updated to:", currentLogPath);
    res.json({ success: true, message: "Log path updated." });
  } else {
    res.status(400).json({ success: false, message: "Invalid path" });
  }
});

app.use("/logs", (req, res, next) => {
  express.static(currentLogPath)(req, res, next);
});

// ✅ Database Configuration — NO credentials in file. Use DB_* or DATABASE_URL in env.
function buildDbConfig() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const skipRewrite = String(process.env.SKIP_DB_HOST_REWRITE || '').toLowerCase() === 'true';
  const host = (!skipRewrite && dbHost === '150.241.244.130' ? 'localhost' : dbHost);
  return {
    host,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'olab',
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
  };
}
const dbConfig = buildDbConfig();

// ✅ Connection configs. When DATABASE_URL host is this server's public IP, rewrite to 127.0.0.1.
function getConnectionConfigs() {
  let databaseUrl = process.env.DATABASE_URL;
  const skipRewrite = String(process.env.SKIP_DB_HOST_REWRITE || '').toLowerCase() === 'true';
  if (!skipRewrite && databaseUrl && databaseUrl.includes('150.241.244.130')) {
    databaseUrl = databaseUrl.replace(/150\.241\.244\.130/g, '127.0.0.1');
    console.log("[DB] DATABASE_URL host rewritten to 127.0.0.1 (same-machine connection)");
  }
  if (databaseUrl) {
    return [
      { connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 },
      { connectionString: databaseUrl, ssl: true, connectionTimeoutMillis: 15000 },
      { connectionString: databaseUrl, ssl: false, connectionTimeoutMillis: 15000 },
    ];
  }
  const isLocal = !dbConfig.host || dbConfig.host === 'localhost' || dbConfig.host === '127.0.0.1';
  if (isLocal) {
    return [
      { ...dbConfig, ssl: false },
      { ...dbConfig, ssl: { rejectUnauthorized: false } },
      { ...dbConfig, ssl: { rejectUnauthorized: false, sslmode: 'require' } },
    ];
  }
  // 150.241.245.36 — exact same as server copy.js: single config, ssl: false, 30s timeout (Render uses this and gets data)
  if (dbConfig.host === '150.241.245.36') {
    return [{ ...dbConfig, ssl: false }];
  }
  return [
    { ...dbConfig, ssl: { rejectUnauthorized: false } },
    { ...dbConfig, ssl: { rejectUnauthorized: false, sslmode: 'require' } },
    { ...dbConfig, ssl: false },
  ];
}

// Stop retrying after 60s so app stays responsive (APIs return "DB not connected" instead of hanging)
const CONNECT_TIMEOUT_MS = 60000;

async function connectWithRetry(startTime = Date.now()) {
  const configs = getConnectionConfigs();
  const isConnectionString = !!process.env.DATABASE_URL;

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    if (Date.now() - startTime > CONNECT_TIMEOUT_MS) {
      console.error("[DB] Connection timeout. Ensure this server can reach the DB (firewall, pg_hba). Check: journalctl -u lab-trading-dashboard -n 80");
      return null;
    }
    try {
      if (isConnectionString) {
        console.log(`🔧 Attempt ${i + 1}: PostgreSQL via DATABASE_URL (ssl: ${!!config.ssl})`);
      } else {
        console.log(`🔧 Attempt ${i + 1}: PostgreSQL to ${config.host}:${config.port}/${config.database} (same config as Render)`);
      }
      const pool = new Pool(config);
      await pool.query('SELECT NOW()');
      console.log(`✅ Connected to PostgreSQL successfully`);
      const countResult = await pool.query('SELECT count(*) as c FROM alltraderecords').catch(() => ({ rows: [{ c: 0 }] }));
      const tradeCount = parseInt(countResult.rows[0]?.c || 0, 10);
      console.log(`[DB] alltraderecords has ${tradeCount} rows — dashboard will show ${tradeCount} trades`);
      return pool;
    } catch (err) {
      console.error(`❌ PostgreSQL connection failed (attempt ${i + 1}):`, err.code || "", err.message);
      if (i === configs.length - 1) {
        console.error("   Retrying in 5 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return connectWithRetry(startTime);
      }
    }
  }
  return null;
}

let poolPromise = connectWithRetry();

// ✅ When DB is unreachable, proxy data from Render (same DB Render uses). Set FALLBACK_API_URL in /etc/lab-trading-dashboard.env
const FALLBACK_API_URL = (process.env.FALLBACK_API_URL || "").trim();
async function fetchFromFallback(path, queryString = "") {
  if (!FALLBACK_API_URL) return null;
  const url = FALLBACK_API_URL.replace(/\/$/, "") + path + (queryString ? "?" + queryString : "");
  try {
    const r = await axios.get(url, { timeout: 20000, validateStatus: () => true });
    if (r.status !== 200) return null;
    return r.data;
  } catch (e) {
    console.warn("[Fallback]", path, e.code || e.message);
    return null;
  }
}

// ✅ Health Check (for monitoring)
app.get("/api/health", (req, res) => {
  res.send("✅ Backend is working!");
});

// ✅ Server config check (no secrets) — verify CORS + DB for GitHub Pages
app.get("/api/server-info", (req, res) => {
  const requestOrigin = req.headers.origin || "(no origin header)";
  const isAllowed = !requestOrigin || requestOrigin === "(no origin header)" || allowedOrigins.includes(requestOrigin);
  res.json({
    ok: true,
    allowedOrigins,
    database: dbConfig.database,
    dbHost: dbConfig.host,
    hasGitHubPagesOrigin: allowedOrigins.includes("https://loveleet.github.io"),
    requestOrigin,
    requestOriginAllowed: isAllowed,
    message: allowedOrigins.includes("https://loveleet.github.io") && dbConfig.database === "olab"
      ? "Cloud server config OK for GitHub Pages (CORS + olab)"
      : "Update server: need CORS for loveleet.github.io and DB=olab",
  });
});

// Stub: alert-rule-books (frontend expects these; avoid 404 when not implemented)
app.get("/api/alert-rule-books", (req, res) => res.json({ ruleBooks: [] }));
app.get("/api/alert-rule-books/:id", (req, res) => res.json({ id: req.params.id, name: "", rules: [] }));
app.post("/api/alert-rule-books", (req, res) => res.status(201).json({ ok: true, id: "stub" }));

// Return current Cloudflare tunnel URL (for GitHub Pages). File or parse cloudflared log.
const TUNNEL_URL_FILE = path.join("/var/run", "lab-tunnel-url");
const TUNNEL_LOG_PATHS = ["/var/log/cloudflared-tunnel.log", "/tmp/tunnel.log"];
const TUNNEL_URL_REGEX = /https:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com/g;
function getTunnelUrlFromLog(logPath) {
  try {
    if (!fs.existsSync(logPath)) return null;
    const content = fs.readFileSync(logPath, "utf8");
    const matches = content.match(TUNNEL_URL_REGEX);
    return matches && matches.length ? matches[matches.length - 1].trim() : null;
  } catch (e) { return null; }
}
app.get("/api/tunnel-url", (req, res) => {
  try {
    if (fs.existsSync(TUNNEL_URL_FILE)) {
      const url = fs.readFileSync(TUNNEL_URL_FILE, "utf8").trim();
      if (url) return res.json({ tunnelUrl: url });
    }
    for (const logPath of TUNNEL_LOG_PATHS) {
      const url = getTunnelUrlFromLog(logPath);
      if (url) return res.json({ tunnelUrl: url });
    }
  } catch (e) { /* ignore */ }
  res.json({ tunnelUrl: null });
});

// ─── Auth: cookie-based sessions (users.password_hash + sessions). GitHub Pages: cookie sameSite=none, secure.
const SESSION_COOKIE = "lab_session";
const SESSION_DAYS = 7;
const LOCKOUT_AFTER = 8;
const LOCKOUT_MINUTES = 15;

function getSessionCookieOpts() {
  const opts = { httpOnly: true, path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 };
  if (process.env.NODE_ENV === "production") {
    opts.secure = true;
    opts.sameSite = "none";
  }
  return opts;
}

async function requireAuth(req, res, next) {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return res.status(401).json({ error: "Not logged in" });
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ error: "Database not connected" });
    const sRes = await pool.query(
      `SELECT s.id, s.user_id, u.email FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > NOW() AND u.is_active = TRUE`,
      [sid]
    );
    if (sRes.rowCount === 0) return res.status(401).json({ error: "Session expired" });
    req.user = { id: sRes.rows[0].user_id, email: sRes.rows[0].email };
    next();
  } catch (e) {
    log(`requireAuth error: ${e.message}`, "ERROR");
    res.status(500).json({ error: "Auth check failed" });
  }
}

// Public paths: no auth (so GitHub Pages can show data). Add signal paths when ALLOW_PUBLIC_READ_SIGNALS.
const PUBLIC_API_PATHS = ["/api/health", "/api/server-info", "/api/tunnel-url", "/api/alert-rule-books"];
const PUBLIC_DATA_PATHS = ["/api/trades", "/api/trades/meta", "/api/trades/running", "/api/trades/closed", "/api/trades/closed/file", "/api/trades/closed/file/status", "/api/trades/closed/file/sync", "/api/trades/filtered", "/api/machines", "/api/trade", "/api/debug", "/api/supertrend", "/api/klines", "/api/sync-open-positions", "/api/futures-balance", "/api/open-position", "/api/pairstatus", "/api/active-loss", "/api/auto-execute", "/api/manage-auto-position", "/api/calculate-signals", "/api/income-history"];
const ALLOW_PUBLIC_READ_SIGNALS = String(process.env.ALLOW_PUBLIC_READ_SIGNALS || "").toLowerCase() === "true";
const PUBLIC_READ_SIGNAL_PATHS = ["/api/pairstatus", "/api/active-loss", "/api/open-position", "/api/calculate-signals"];

app.use((req, res, next) => {
  if (req.path.startsWith("/api/") && (PUBLIC_API_PATHS.includes(req.path) || PUBLIC_DATA_PATHS.includes(req.path))) return next();
  if (req.path.startsWith("/api/alert-rule-books")) return next();
  if (ALLOW_PUBLIC_READ_SIGNALS && req.path.startsWith("/api/") && PUBLIC_READ_SIGNAL_PATHS.some((p) => req.path === p || req.path.startsWith(p + "/"))) return next();
  if (req.path.startsWith("/api/") || req.path === "/auth/me") return requireAuth(req, res, next);
  next();
});

// POST /auth/login — password_hash = crypt(), lockout on failed attempts
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const em = (email || "").trim();
  const pw = (password || "").trim();
  if (!em || !pw) return res.status(400).json({ error: "email and password required" });
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ error: "Database not connected" });
    const userRes = await pool.query(
      `SELECT id, email FROM users
       WHERE email = $1 AND is_active = TRUE
         AND (locked_until IS NULL OR locked_until <= NOW())
         AND password_hash = crypt($2, password_hash)`,
      [em, pw]
    );
    if (userRes.rowCount === 0) {
      await pool.query(
        `UPDATE users SET failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN NOW() + ($3 || ' minutes')::INTERVAL ELSE locked_until END
         WHERE email = $1`,
        [em, LOCKOUT_AFTER, LOCKOUT_MINUTES]
      ).catch(() => {});
      return res.status(401).json({ error: "invalid credentials" });
    }
    const user = userRes.rows[0];
    await pool.query(`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE email = $1`, [em]);
    const sessionRes = await pool.query(
      `INSERT INTO sessions (user_id, expires_at) VALUES ($1, NOW() + ($2 || ' days')::INTERVAL)
       RETURNING id`,
      [user.id, SESSION_DAYS]
    );
    const sessionId = sessionRes.rows[0].id;
    res.cookie(SESSION_COOKIE, sessionId, getSessionCookieOpts());
    res.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (e) {
    log(`auth/login error: ${e.message}`, "ERROR");
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/auth/logout", (req, res) => {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (sid) {
    poolPromise.then((pool) => {
      if (pool) pool.query(`DELETE FROM sessions WHERE id = $1`, [sid]).catch(() => {});
    }).catch(() => {});
  }
  res.clearCookie(SESSION_COOKIE, { ...getSessionCookieOpts(), maxAge: 0 });
  res.json({ ok: true });
});

app.get("/auth/me", (req, res) => res.json({ ok: true, user: req.user }));

app.post("/auth/extend-session", async (req, res) => {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return res.status(401).json({ error: "Not logged in" });
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ error: "Database not connected" });
    const r = await pool.query("SELECT id FROM sessions WHERE id = $1 AND expires_at > NOW()", [sid]);
    if (!r.rows?.length) return res.status(401).json({ error: "Session expired" });
    await pool.query("UPDATE sessions SET expires_at = NOW() + ($1 || ' days')::INTERVAL WHERE id = $2", [SESSION_DAYS, sid]);
    res.json({ ok: true });
  } catch (e) {
    log(`auth/extend-session error: ${e.message}`, "ERROR");
    res.status(500).json({ error: "Failed to extend session" });
  }
});

// ✅ Debug: table row counts + DB source (no secrets) — explains why cloud shows fewer trades
app.get("/api/debug", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      if (FALLBACK_API_URL) {
        const debug = await fetchFromFallback("/api/debug");
        if (debug && debug.ok) return res.json({ ...debug, dbSource: (debug.dbSource || "remote") + " (via fallback)" });
        const trades = await fetchFromFallback("/api/trades");
        const machines = await fetchFromFallback("/api/machines");
        const tn = (trades && trades.trades && trades.trades.length) || (trades && trades._meta && trades._meta.count) || 0;
        const mn = (machines && machines.machines && machines.machines.length) || 0;
        if (tn > 0 || mn > 0) {
          return res.json({ ok: true, counts: { alltraderecords: tn, machines: mn, pairstatus: "n/a" }, dbSource: "fallback:" + FALLBACK_API_URL });
        }
      }
      return res.json({
        ok: false,
        error: "Database not connected",
        dbSource: process.env.DATABASE_URL ? "DATABASE_URL (connection failed or timeout)" : "DB_* / local",
        hint: "Set FALLBACK_API_URL=https://lab-anish.onrender.com in /etc/lab-trading-dashboard.env and restart to use Render data when DB is unreachable."
      });
    }
    const tables = ["alltraderecords", "machines", "pairstatus"];
    const counts = {};
    for (const table of tables) {
      try {
        const r = await pool.query(`SELECT count(*) as c FROM ${table}`);
        counts[table] = parseInt(r.rows[0]?.c ?? 0, 10);
      } catch (e) {
        counts[table] = e.code === "42P01" ? "missing" : e.message;
      }
    }
    const tradeCount = typeof counts.alltraderecords === "number" ? counts.alltraderecords : 0;
    const tradesEmpty = tradeCount === 0 || counts.alltraderecords === "missing";
    const dbSource = process.env.DATABASE_URL ? "DATABASE_URL (remote)" : "DB_* / local";
    let hint = null;
    if (tradesEmpty) {
      hint = "alltraderecords is empty or missing — set DATABASE_URL (or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME) in /etc/lab-trading-dashboard.env, then restart.";
    } else if (tradeCount < 50) {
      hint = "This app is using the local DB with very few rows. To see real data: set DATABASE_URL (or DB_*) in /etc/lab-trading-dashboard.env to your Postgres URL and restart.";
    }
    res.json({ ok: true, counts, dbSource, hint });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ✅ API: Fetch All Trades
// Helper: true if error is "table does not exist"
function isMissingTable(err) {
  return err && (err.code === "42P01" || (err.message && err.message.includes("does not exist")));
}

// ✅ API: Fetch SuperTrend Signals (return empty if table missing or DB not connected — avoid 500)
app.get("/api/supertrend", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      const fallback = await fetchFromFallback("/api/supertrend");
      if (fallback && (fallback.supertrend || Array.isArray(fallback.supertrend))) return res.json(fallback);
      return res.json({ supertrend: [] });
    }
    const result = await pool.query(
      'SELECT source, trend, timestamp FROM supertrend ORDER BY timestamp DESC LIMIT 10;'
    );
    res.json({ supertrend: result.rows || [] });
  } catch (error) {
    if (isMissingTable(error)) {
      return res.json({ supertrend: [] });
    }
    console.error("❌ [SuperTrend] Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch SuperTrend data" });
  }
});

// ── Split trade fetch: running (small, refresh often) vs closed (large, cache + incremental) ──
const RUNNING_TRADE_TYPES = ["running", "hedge_hold", "assigned", "assign"];
const CLOSED_TRADE_TYPES = ["close", "hedge_close"];
const RUNNING_TYPE_LIST = RUNNING_TRADE_TYPES.map((t) => `'${t}'`).join(", ");
const CLOSED_TYPE_LIST = CLOSED_TRADE_TYPES.map((t) => `'${t}'`).join(", ");

// ── Server-side closed trades file (JSONL = append new closes without rewriting all) ──
const CLOSED_FILE_CACHE_VERSION = 2;
const CLOSED_TRADES_DIR = path.join(__dirname, "..", "data");
const CLOSED_TRADES_FILE = path.join(CLOSED_TRADES_DIR, "closed_trades.json"); // legacy
const CLOSED_TRADES_JSONL = path.join(CLOSED_TRADES_DIR, "closed_trades.jsonl");
const CLOSED_TRADES_META_FILE = path.join(CLOSED_TRADES_DIR, "closed_trades_meta.json");
const CLOSED_FILE_PAGE_SIZE = 2000;

let closedFileSyncState = { syncing: false, downloaded: 0, total: 0, phase: "idle" };

function ensureClosedTradesDir() {
  if (!fs.existsSync(CLOSED_TRADES_DIR)) fs.mkdirSync(CLOSED_TRADES_DIR, { recursive: true });
}

function readClosedTradesMetaFile() {
  try {
    if (!fs.existsSync(CLOSED_TRADES_META_FILE)) return null;
    return JSON.parse(fs.readFileSync(CLOSED_TRADES_META_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeClosedTradesMetaFile(meta) {
  ensureClosedTradesDir();
  fs.writeFileSync(CLOSED_TRADES_META_FILE, JSON.stringify(meta, null, 2));
}

/** Read closed trades: prefer JSONL (append-friendly); fall back to legacy JSON once. */
function readClosedTradesFile() {
  try {
    if (fs.existsSync(CLOSED_TRADES_JSONL)) {
      const text = fs.readFileSync(CLOSED_TRADES_JSONL, "utf8");
      if (!text.trim()) return [];
      const trades = [];
      for (const line of text.split("\n")) {
        const s = line.trim();
        if (!s) continue;
        try {
          trades.push(JSON.parse(s));
        } catch (_) {}
      }
      return trades;
    }
    if (fs.existsSync(CLOSED_TRADES_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CLOSED_TRADES_FILE, "utf8"));
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray(raw.trades)) return raw.trades;
    }
    return [];
  } catch {
    return [];
  }
}

function closedFileExists() {
  return (
    (fs.existsSync(CLOSED_TRADES_JSONL) && fs.statSync(CLOSED_TRADES_JSONL).size > 0) ||
    (fs.existsSync(CLOSED_TRADES_FILE) && fs.statSync(CLOSED_TRADES_FILE).size > 0)
  );
}

/** One-time: convert legacy closed_trades.json → jsonl without re-querying DB. */
function migrateLegacyClosedJsonToJsonl() {
  if (fs.existsSync(CLOSED_TRADES_JSONL) && fs.statSync(CLOSED_TRADES_JSONL).size > 0) return false;
  if (!fs.existsSync(CLOSED_TRADES_FILE)) return false;
  const trades = readClosedTradesFile();
  if (!trades.length) return false;
  const fileMeta = readClosedTradesMetaFile() || {};
  const meta = {
    ...fileMeta,
    cacheVersion: CLOSED_FILE_CACHE_VERSION,
    closedCount: fileMeta.closedCount ?? trades.length,
    storage: "jsonl",
    filePath: "data/closed_trades.jsonl",
    mode: "migrated",
    lastSyncAt: new Date().toISOString(),
  };
  writeClosedTradesFileFull(trades, meta);
  console.log(`[closed-file] Migrated ${trades.length} rows from JSON → JSONL (append-ready)`);
  return true;
}

/** Full rewrite (first build / flush only). Writes JSONL + meta; removes legacy JSON. */
function writeClosedTradesFileFull(trades, meta) {
  ensureClosedTradesDir();
  const body = trades.map((t) => JSON.stringify(t)).join("\n") + (trades.length ? "\n" : "");
  fs.writeFileSync(CLOSED_TRADES_JSONL, body);
  if (meta) writeClosedTradesMetaFile(meta);
  try {
    if (fs.existsSync(CLOSED_TRADES_FILE)) fs.unlinkSync(CLOSED_TRADES_FILE);
  } catch (_) {}
}

/** Append only newly closed rows — does not rewrite existing file contents. */
function appendClosedTradesToFile(newRows, meta) {
  if (!newRows || newRows.length === 0) {
    if (meta) writeClosedTradesMetaFile(meta);
    return;
  }
  ensureClosedTradesDir();
  // Migrate legacy JSON → JSONL once before appending
  if (!fs.existsSync(CLOSED_TRADES_JSONL) && fs.existsSync(CLOSED_TRADES_FILE)) {
    const existing = readClosedTradesFile();
    writeClosedTradesFileFull(existing, meta);
  }
  const chunk = newRows.map((t) => JSON.stringify(t)).join("\n") + "\n";
  fs.appendFileSync(CLOSED_TRADES_JSONL, chunk);
  if (meta) writeClosedTradesMetaFile(meta);
}

function deleteClosedTradesFiles() {
  try {
    if (fs.existsSync(CLOSED_TRADES_FILE)) fs.unlinkSync(CLOSED_TRADES_FILE);
  } catch (_) {}
  try {
    if (fs.existsSync(CLOSED_TRADES_JSONL)) fs.unlinkSync(CLOSED_TRADES_JSONL);
  } catch (_) {}
  try {
    if (fs.existsSync(CLOSED_TRADES_META_FILE)) fs.unlinkSync(CLOSED_TRADES_META_FILE);
  } catch (_) {}
}

function closedTradeRowKey(t) {
  const uid = t?.unique_id ?? t?.Unique_ID ?? t?.uid;
  if (uid != null && String(uid).trim()) return String(uid).trim();
  return [t?.pair, t?.machineid, t?.candel_time, t?.type, t?.action].join("|");
}

function mergeClosedTradeRows(existing, incoming) {
  const map = new Map();
  for (const t of existing) map.set(closedTradeRowKey(t), t);
  for (const t of incoming) map.set(closedTradeRowKey(t), t);
  return [...map.values()];
}

async function queryDbClosedMeta(pool) {
  const result = await pool.query(`
    SELECT COUNT(*)::int AS closed_count,
           MAX(COALESCE(created_at, candel_time::timestamptz)) AS last_closed_at
    FROM alltraderecords
    WHERE type IN (${CLOSED_TYPE_LIST})
  `);
  const row = result.rows[0] || {};
  return {
    closedCount: row.closed_count ?? 0,
    lastClosedAt: row.last_closed_at ? new Date(row.last_closed_at).toISOString() : null,
  };
}

async function queryClosedTradesPage(pool, page, limit = CLOSED_FILE_PAGE_SIZE) {
  const offset = (page - 1) * limit;
  const result = await pool.query(
    `
    SELECT * FROM alltraderecords
    WHERE type IN (${CLOSED_TYPE_LIST})
    ORDER BY COALESCE(created_at, candel_time::timestamptz) ASC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );
  return result.rows;
}

async function queryClosedTradesSince(pool, sinceAt, { inclusive = false } = {}) {
  const sinceDate = new Date(sinceAt);
  if (Number.isNaN(sinceDate.getTime())) return [];
  const cmp = inclusive ? ">=" : ">";
  const result = await pool.query(
    `
    SELECT * FROM alltraderecords
    WHERE type IN (${CLOSED_TYPE_LIST})
      AND COALESCE(created_at, candel_time::timestamptz) ${cmp} $1
    ORDER BY COALESCE(created_at, candel_time::timestamptz) ASC
    `,
    [sinceDate.toISOString()]
  );
  return result.rows;
}

async function queryClosedTradesTail(pool, limit) {
  const n = Math.min(Math.max(1, limit), 5000);
  const result = await pool.query(
    `
    SELECT * FROM alltraderecords
    WHERE type IN (${CLOSED_TYPE_LIST})
    ORDER BY COALESCE(created_at, candel_time::timestamptz) DESC
    LIMIT $1
    `,
    [n]
  );
  return result.rows.reverse();
}

function sameTimestamp(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return !Number.isNaN(ta) && !Number.isNaN(tb) && ta === tb;
}

async function ensureClosedTradesFile(pool, { force = false } = {}) {
  migrateLegacyClosedJsonToJsonl();
  const dbMeta = await queryDbClosedMeta(pool);
  const fileMeta = readClosedTradesMetaFile();
  let fileTrades = readClosedTradesFile();

  const upToDate =
    !force &&
    fileMeta &&
    fileTrades.length > 0 &&
    fileTrades.length === dbMeta.closedCount &&
    fileMeta.closedCount === dbMeta.closedCount &&
    sameTimestamp(fileMeta.lastClosedAt, dbMeta.lastClosedAt);

  if (upToDate) {
    closedFileSyncState = {
      syncing: false,
      downloaded: fileTrades.length,
      total: dbMeta.closedCount,
      phase: "ready",
    };
    return { trades: fileTrades, meta: fileMeta, fromFile: true, updated: false };
  }

  closedFileSyncState = {
    syncing: true,
    downloaded: 0,
    total: dbMeta.closedCount,
    phase: force ? "rebuild" : "sync",
  };

  // Full rebuild ONLY on flush / missing file / file ahead of DB (corruption).
  // New closes → always incremental append.
  const needsFull =
    force || !closedFileExists() || fileTrades.length === 0 || dbMeta.closedCount < fileTrades.length;

  let updated = false;
  let appended = 0;

  if (needsFull) {
    console.log(`[closed-file] Full rebuild → ${CLOSED_TRADES_JSONL} (${dbMeta.closedCount} rows)`);
    const all = [];
    let page = 1;
    while (true) {
      const batch = await queryClosedTradesPage(pool, page, CLOSED_FILE_PAGE_SIZE);
      all.push(...batch);
      closedFileSyncState.downloaded = all.length;
      if (batch.length < CLOSED_FILE_PAGE_SIZE) break;
      page += 1;
    }
    fileTrades = all;
    const newMeta = {
      cacheVersion: CLOSED_FILE_CACHE_VERSION,
      closedCount: dbMeta.closedCount,
      lastClosedAt: dbMeta.lastClosedAt,
      lastSyncAt: new Date().toISOString(),
      storage: "jsonl",
      filePath: "data/closed_trades.jsonl",
      mode: "full",
    };
    writeClosedTradesFileFull(fileTrades, newMeta);
    closedFileSyncState = {
      syncing: false,
      downloaded: fileTrades.length,
      total: dbMeta.closedCount,
      phase: "ready",
    };
    console.log(`[closed-file] Full save ${fileTrades.length} closed trades`);
    return { trades: fileTrades, meta: newMeta, fromFile: true, updated: true };
  }

  // Incremental: fetch rows at/after file meta (inclusive catches same-timestamp closes), append to JSONL
  const sinceAt = fileMeta.lastClosedAt;
  console.log(`[closed-file] Incremental append since ${sinceAt} (inclusive)`);
  let newRows = await queryClosedTradesSince(pool, sinceAt, { inclusive: true });
  if (newRows.length > 0) {
    const beforeKeys = new Set(fileTrades.map(closedTradeRowKey));
    const trulyNew = newRows.filter((t) => !beforeKeys.has(closedTradeRowKey(t)));
    appended = trulyNew.length;
    if (trulyNew.length > 0) {
      fileTrades = mergeClosedTradeRows(fileTrades, trulyNew);
      const newMeta = {
        cacheVersion: CLOSED_FILE_CACHE_VERSION,
        closedCount: dbMeta.closedCount,
        lastClosedAt: dbMeta.lastClosedAt,
        lastSyncAt: new Date().toISOString(),
        storage: "jsonl",
        filePath: "data/closed_trades.jsonl",
        mode: "append",
        lastAppended: trulyNew.length,
      };
      appendClosedTradesToFile(trulyNew, newMeta);
      updated = true;
      console.log(`[closed-file] Appended ${trulyNew.length} new closed trade(s) to JSONL`);
    } else {
      console.log(`[closed-file] Incremental rows were all duplicates — will gap-fill if count still short`);
    }
  }

  if (fileTrades.length < dbMeta.closedCount) {
    // Count drift: fetch recent tail and merge any rows missing from file
    const gap = dbMeta.closedCount - fileTrades.length;
    console.log(`[closed-file] Gap fill: file ${fileTrades.length} vs DB ${dbMeta.closedCount} (gap ${gap})`);
    const tailRows = await queryClosedTradesTail(pool, gap + 100);
    const beforeKeys = new Set(fileTrades.map(closedTradeRowKey));
    const missing = tailRows.filter((t) => !beforeKeys.has(closedTradeRowKey(t)));
    if (missing.length > 0) {
      fileTrades = mergeClosedTradeRows(fileTrades, missing);
      appended = missing.length;
      const newMeta = {
        cacheVersion: CLOSED_FILE_CACHE_VERSION,
        closedCount: dbMeta.closedCount,
        lastClosedAt: dbMeta.lastClosedAt,
        lastSyncAt: new Date().toISOString(),
        storage: "jsonl",
        filePath: "data/closed_trades.jsonl",
        mode: "gap-fill",
        lastAppended: missing.length,
      };
      appendClosedTradesToFile(missing, newMeta);
      updated = true;
      console.log(`[closed-file] Gap-filled ${missing.length} closed trade(s)`);
    } else {
      const newMeta = {
        ...(fileMeta || {}),
        cacheVersion: CLOSED_FILE_CACHE_VERSION,
        closedCount: dbMeta.closedCount,
        lastClosedAt: dbMeta.lastClosedAt,
        lastSyncAt: new Date().toISOString(),
        storage: "jsonl",
        filePath: "data/closed_trades.jsonl",
        mode: "meta-only",
      };
      writeClosedTradesMetaFile(newMeta);
    }
  } else if (
    fileMeta.closedCount !== dbMeta.closedCount ||
    !sameTimestamp(fileMeta.lastClosedAt, dbMeta.lastClosedAt)
  ) {
    // Count matches but meta timestamps/count field drifted — refresh meta only
    const newMeta = {
      ...(fileMeta || {}),
      cacheVersion: CLOSED_FILE_CACHE_VERSION,
      closedCount: dbMeta.closedCount,
      lastClosedAt: dbMeta.lastClosedAt,
      lastSyncAt: new Date().toISOString(),
      storage: "jsonl",
      filePath: "data/closed_trades.jsonl",
      mode: "meta-only",
    };
    writeClosedTradesMetaFile(newMeta);
    closedFileSyncState = {
      syncing: false,
      downloaded: fileTrades.length,
      total: dbMeta.closedCount,
      phase: "ready",
    };
    return { trades: fileTrades, meta: newMeta, fromFile: true, updated: false };
  }

  closedFileSyncState = {
    syncing: false,
    downloaded: fileTrades.length,
    total: dbMeta.closedCount,
    phase: "ready",
  };
  const meta = readClosedTradesMetaFile();
  return { trades: fileTrades, meta, fromFile: true, updated, appended };
}

/** Return file contents immediately; sync DB→file in background when stale. */
function scheduleClosedFileSync(pool, { force = false } = {}) {
  if (!pool || closedFileSyncState.syncing) return;
  ensureClosedTradesFile(pool, { force }).catch((err) =>
    console.error("[closed-file] Background sync error:", err.message)
  );
}

function readClosedTradesFileResponse() {
  const fileTrades = readClosedTradesFile();
  const fileMeta = readClosedTradesMetaFile();
  return {
    trades: fileTrades,
    meta: fileMeta,
    hasFile: fileTrades.length > 0 && !!fileMeta,
  };
}

function parseClosedPageLimit(raw, defaultLimit = 2000) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return defaultLimit;
  return Math.min(n, 5000);
}

// GET /api/trades/meta — counts + last closed timestamp (tiny payload for cache checks)
app.get("/api/trades/meta", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json({
        runningCount: 0,
        closedCount: 0,
        lastClosedAt: null,
        totalCount: 0,
      });
    }
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE type IN (${RUNNING_TYPE_LIST}))::int AS running_count,
        COUNT(*) FILTER (WHERE type IN (${CLOSED_TYPE_LIST}))::int AS closed_count,
        MAX(COALESCE(created_at, candel_time::timestamptz)) FILTER (WHERE type IN (${CLOSED_TYPE_LIST})) AS last_closed_at
      FROM alltraderecords
    `);
    const row = result.rows[0] || {};
    res.json({
      runningCount: row.running_count ?? 0,
      closedCount: row.closed_count ?? 0,
      lastClosedAt: row.last_closed_at ? new Date(row.last_closed_at).toISOString() : null,
      totalCount: row.total_count ?? 0,
    });
  } catch (error) {
    if (isMissingTable(error)) {
      return res.json({ runningCount: 0, closedCount: 0, lastClosedAt: null, totalCount: 0 });
    }
    console.error("❌ [Trades/meta] Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch trades meta" });
  }
});

// GET /api/trades/running — only active trades (refreshed every poll)
app.get("/api/trades/running", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json({ trades: [], _meta: { count: 0, segment: "running" } });
    }
    const result = await pool.query(`
      SELECT * FROM alltraderecords
      WHERE type IN (${RUNNING_TYPE_LIST})
    `);
    res.json({
      trades: result.rows,
      _meta: { count: result.rows.length, segment: "running" },
    });
  } catch (error) {
    if (isMissingTable(error)) {
      return res.json({ trades: [], _meta: { count: 0, segment: "running" } });
    }
    console.error("❌ [Trades/running] Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch running trades" });
  }
});

// GET /api/trades/closed?page=&limit=&since_at= — paginated or incremental closed trades
app.get("/api/trades/closed", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json({
        trades: [],
        _meta: { count: 0, segment: "closed", page: 1, totalPages: 0, closedCount: 0 },
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = parseClosedPageLimit(req.query.limit, 2000);
    const sinceAt = (req.query.since_at || "").trim();
    const inclusive = req.query.inclusive === "1" || req.query.inclusive === "true";
    const tail = parseInt(req.query.tail, 10);
    const offset = (page - 1) * limit;

    const countResult = await pool.query(`
      SELECT COUNT(*)::int AS c FROM alltraderecords WHERE type IN (${CLOSED_TYPE_LIST})
    `);
    const closedCount = countResult.rows[0]?.c ?? 0;

    let rows = [];
    if (Number.isFinite(tail) && tail > 0) {
      rows = await queryClosedTradesTail(pool, tail);
      return res.json({
        trades: rows,
        _meta: {
          count: rows.length,
          segment: "closed",
          mode: "tail",
          tail,
          closedCount,
        },
      });
    }
    if (sinceAt) {
      const sinceDate = new Date(sinceAt);
      if (Number.isNaN(sinceDate.getTime())) {
        return res.status(400).json({ error: "Invalid since_at" });
      }
      const cmp = inclusive ? ">=" : ">";
      const incremental = await pool.query(
        `
        SELECT * FROM alltraderecords
        WHERE type IN (${CLOSED_TYPE_LIST})
          AND COALESCE(created_at, candel_time::timestamptz) ${cmp} $1
        ORDER BY COALESCE(created_at, candel_time::timestamptz) ASC
        LIMIT $2
        `,
        [sinceDate.toISOString(), limit]
      );
      rows = incremental.rows;
      return res.json({
        trades: rows,
        _meta: {
          count: rows.length,
          segment: "closed",
          mode: "incremental",
          sinceAt,
          inclusive,
          closedCount,
        },
      });
    }

    const paged = await pool.query(
      `
      SELECT * FROM alltraderecords
      WHERE type IN (${CLOSED_TYPE_LIST})
      ORDER BY COALESCE(created_at, candel_time::timestamptz) ASC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );
    rows = paged.rows;
    const totalPages = Math.max(1, Math.ceil(closedCount / limit));
    res.json({
      trades: rows,
      _meta: {
        count: rows.length,
        segment: "closed",
        mode: "paged",
        page,
        limit,
        totalPages,
        closedCount,
      },
    });
  } catch (error) {
    if (isMissingTable(error)) {
      return res.json({
        trades: [],
        _meta: { count: 0, segment: "closed", page: 1, totalPages: 0, closedCount: 0 },
      });
    }
    console.error("❌ [Trades/closed] Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch closed trades" });
  }
});

// GET /api/trades/closed/file/status — JSON file sync progress (for progress bar)
app.get("/api/trades/closed/file/status", async (req, res) => {
  try {
    const pool = await poolPromise;
    const dbMeta = pool ? await queryDbClosedMeta(pool) : { closedCount: 0, lastClosedAt: null };
    migrateLegacyClosedJsonToJsonl();
    const fileMeta = readClosedTradesMetaFile();
    const hasFile = closedFileExists();
    const fileTrades = readClosedTradesFile();
    const fileLineCount = fileTrades.length;
    const fileCount = fileMeta?.closedCount ?? fileLineCount;
    const percent =
      closedFileSyncState.total > 0
        ? Math.min(100, Math.round((closedFileSyncState.downloaded / closedFileSyncState.total) * 100))
        : hasFile
          ? 100
          : 0;
    res.json({
      ...closedFileSyncState,
      percent,
      fileCount,
      fileLineCount,
      hasFile,
      fileMeta,
      dbMeta,
      filePath: fileMeta?.filePath || "data/closed_trades.jsonl",
    });
    // Keep server file in sync in background (append-only when new closes exist)
    if (pool && !closedFileSyncState.syncing) {
      const stale =
        !fileMeta ||
        !hasFile ||
        fileLineCount !== dbMeta.closedCount ||
        fileMeta.closedCount !== dbMeta.closedCount ||
        !sameTimestamp(fileMeta.lastClosedAt, dbMeta.lastClosedAt);
      if (stale) scheduleClosedFileSync(pool, { force: false });
    }
  } catch (error) {
    console.error("❌ [Trades/closed/file/status] Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to read file status" });
  }
});

// GET /api/trades/closed/file — closed trades from server JSON file (fast read; background sync if stale)
app.get("/api/trades/closed/file", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json({ trades: [], _meta: { count: 0, storage: "file" } });
    }
    const force = req.query.force === "1" || req.query.flush === "1";
    const block = req.query.wait === "1" || force;

    if (!block) {
      const { trades, meta, hasFile } = readClosedTradesFileResponse();
      if (hasFile) {
        scheduleClosedFileSync(pool, { force: false });
        return res.json({
          trades,
          _meta: {
            count: trades.length,
            segment: "closed",
            storage: "file",
            fromFile: true,
            updated: false,
            fast: true,
            ...meta,
            syncState: closedFileSyncState,
          },
        });
      }
    }

    const result = await ensureClosedTradesFile(pool, { force });
    res.json({
      trades: result.trades,
      _meta: {
        count: result.trades.length,
        segment: "closed",
        storage: "file",
        fromFile: true,
        updated: result.updated,
        ...result.meta,
        syncState: closedFileSyncState,
      },
    });
  } catch (error) {
    if (isMissingTable(error)) {
      return res.json({ trades: [], _meta: { count: 0, storage: "file" } });
    }
    console.error("❌ [Trades/closed/file] Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to read closed trades file" });
  }
});

// POST /api/trades/closed/file/sync — await DB→JSONL sync (shared cloud file for all users)
app.post("/api/trades/closed/file/sync", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.json({ ok: true, count: 0, _meta: { closedCount: 0 } });
    const result = await ensureClosedTradesFile(pool, { force: false });
    res.json({
      ok: true,
      count: result.trades.length,
      updated: result.updated,
      _meta: result.meta,
      syncState: closedFileSyncState,
    });
  } catch (error) {
    console.error("❌ [Trades/closed/file/sync] Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to sync closed trades file" });
  }
});

// POST /api/trades/closed/file/flush — delete JSON file and rebuild from DB
app.post("/api/trades/closed/file/flush", async (req, res) => {
  try {
    deleteClosedTradesFiles();
    closedFileSyncState = { syncing: false, downloaded: 0, total: 0, phase: "idle" };
    const pool = await poolPromise;
    if (!pool) return res.json({ ok: true, count: 0 });
    const result = await ensureClosedTradesFile(pool, { force: true });
    res.json({ ok: true, count: result.trades.length, _meta: result.meta });
  } catch (error) {
    console.error("❌ [Trades/closed/file/flush] Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to flush closed trades file" });
  }
});

// No LIMIT — return all rows from the configured DB.
app.get("/api/trades", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      const fallback = await fetchFromFallback("/api/trades");
      if (fallback && (fallback.trades || Array.isArray(fallback.trades))) {
        console.log("[Trades] Fallback:", (fallback.trades || []).length, "rows");
        return res.json(fallback);
      }
      console.log("[Trades] No pool — returning empty");
      return res.json({ trades: [], _meta: { count: 0, table: "alltraderecords" } });
    }
    const result = await pool.query("SELECT * FROM alltraderecords;");
    const count = result.rows.length;
    if (count === 0) console.log("[Trades] Table is empty — add data or set DATABASE_URL in /etc/lab-trading-dashboard.env to point to your DB.");
    else console.log("[Trades] Fetched", count, "rows from alltraderecords");
    res.json({
      trades: result.rows,
      _meta: {
        count,
        table: "alltraderecords",
        ...(count === 0 && { demoData: true, hint: "No rows in alltraderecords. Set DATABASE_URL (or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME) in /etc/lab-trading-dashboard.env on this server to point to your Postgres and restart." })
      }
    });
  } catch (error) {
    if (isMissingTable(error)) {
      console.log("[Trades] Table alltraderecords missing — returning empty");
      return res.json({ trades: [], _meta: { count: 0, table: "alltraderecords", error: "table missing" } });
    }
    console.error("❌ [Trades] Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch trades" });
  }
});

// GET /api/trade?unique_id= — single trade for Live Trade / Information view
app.get("/api/trade", async (req, res) => {
  const uniqueId = req.query.unique_id;
  if (!uniqueId) {
    return res.status(400).json({ error: "unique_id query param required" });
  }
  const uid = String(Array.isArray(uniqueId) ? uniqueId[0] : uniqueId).trim();
  try {
    const pool = await poolPromise;
    if (!pool) {
      const fallback = await fetchFromFallback(`/api/trade?unique_id=${encodeURIComponent(uid)}`);
      if (fallback && typeof fallback === "object") return res.json(fallback);
      return res.json({ trade: null });
    }
    const result = await pool.query(
      `SELECT * FROM alltraderecords
       WHERE TRIM(unique_id::text) = $1
          OR TRIM(chain_root_unique_id::text) = $1
       LIMIT 1`,
      [uid]
    );
    res.json({ trade: result.rows[0] || null });
  } catch (error) {
    if (isMissingTable(error)) return res.json({ trade: null });
    console.error("❌ Query Error (/api/trade):", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch trade" });
  }
});

// ✅ API: Fetch Machines
app.get("/api/machines", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      const fallback = await fetchFromFallback("/api/machines");
      if (fallback && (fallback.machines || Array.isArray(fallback.machines))) {
        return res.json(fallback);
      }
      return res.json({ machines: [] });
    }
    const result = await pool.query("SELECT machineid, active FROM machines;");
    res.json({ machines: result.rows });
  } catch (error) {
    if (isMissingTable(error)) return res.json({ machines: [] });
    console.error("❌ Query Error (/api/machines):", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch machines" });
  }
});

// ✅ API: Fetch EMA Trend Data from pairstatus
const EMA_TREND_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"];

function isBullTrendValue(val) {
  const s = String(val ?? "").trim().toUpperCase();
  return s.includes("BULL") || s.includes("UP");
}

function isBearTrendValue(val) {
  const s = String(val ?? "").trim().toUpperCase();
  return s.includes("BEAR") || s.includes("DOWN");
}

function overallEmaNeedsAggregate(row, tf) {
  const pct = parseFloat(row[`overall_ema_trend_percentage_${tf}`]);
  const trend = String(row[`overall_ema_trend_${tf}`] ?? "").trim().toUpperCase();
  return !Number.isFinite(pct) || pct <= 0 || trend === "NEUTRAL" || trend === "";
}

async function aggregateOverallEmaTrends(pool, timeframes = EMA_TREND_INTERVALS) {
  const cols = timeframes.map((tf) => `ema_trend_${tf}`).join(", ");
  const result = await pool.query(`SELECT ${cols} FROM pairstatus`);
  const out = {};
  for (const tf of timeframes) {
    const col = `ema_trend_${tf}`;
    let bull = 0;
    let bear = 0;
    for (const row of result.rows) {
      const v = row[col];
      if (isBullTrendValue(v)) bull += 1;
      else if (isBearTrendValue(v)) bear += 1;
    }
    const total = bull + bear;
    if (total === 0) {
      out[`overall_ema_trend_${tf}`] = "NEUTRAL";
      out[`overall_ema_trend_percentage_${tf}`] = 0;
      continue;
    }
    if (bull >= bear) {
      out[`overall_ema_trend_${tf}`] = "BULLISH";
      out[`overall_ema_trend_percentage_${tf}`] = (bull / total) * 100;
    } else {
      out[`overall_ema_trend_${tf}`] = "BEARISH";
      out[`overall_ema_trend_percentage_${tf}`] = (bear / total) * 100;
    }
  }
  return out;
}

app.get("/api/pairstatus", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      const fallback = await fetchFromFallback("/api/pairstatus");
      if (fallback && typeof fallback === "object") return res.json(fallback);
      return res.json({});
    }
    const result = await pool.query(`
      SELECT *
      FROM pairstatus
      ORDER BY last_updated DESC
      LIMIT 1
    `);
    const row = result.rows[0] || {};
    const missingLongTf = ["1h", "4h", "1d"].some((tf) => overallEmaNeedsAggregate(row, tf));
    if (missingLongTf) {
      const agg = await aggregateOverallEmaTrends(pool, ["1h", "4h", "1d"]);
      for (const tf of ["1h", "4h", "1d"]) {
        if (overallEmaNeedsAggregate(row, tf)) {
          row[`overall_ema_trend_${tf}`] = agg[`overall_ema_trend_${tf}`];
          row[`overall_ema_trend_percentage_${tf}`] = agg[`overall_ema_trend_percentage_${tf}`];
        }
      }
    }
    res.json(row);
  } catch (error) {
    if (isMissingTable(error)) return res.json({});
    console.error("❌ Query Error (/api/pairstatus):", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch pairstatus" });
  }
});

// ✅ API: Clients CRUD (person + nested exchange accounts)
// Status is always Deactive from this UI. API/secret keys are AES-256-GCM encrypted at rest.
const CLIENT_SECRET_ENC_PREFIX = "enc:v1:";

function getClientCredentialsKey() {
  const raw = String(process.env.CLIENT_CREDENTIALS_KEY || "").trim();
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest(); // 32 bytes
}

function isEncryptedClientSecret(value) {
  return typeof value === "string" && value.startsWith(CLIENT_SECRET_ENC_PREFIX);
}

function isMaskedClientSecret(value) {
  return typeof value === "string" && value.includes("****");
}

function encryptClientSecret(plain) {
  if (plain == null || String(plain).trim() === "") return null;
  const key = getClientCredentialsKey();
  if (!key) {
    const err = new Error("CLIENT_CREDENTIALS_KEY is not set on the server — cannot store secrets encrypted");
    err.code = "NO_CLIENT_CREDENTIALS_KEY";
    throw err;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return CLIENT_SECRET_ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptClientSecret(stored) {
  if (stored == null || stored === "") return "";
  const s = String(stored);
  if (!isEncryptedClientSecret(s)) return s; // legacy plaintext
  const key = getClientCredentialsKey();
  if (!key) return "";
  try {
    const buf = Buffer.from(s.slice(CLIENT_SECRET_ENC_PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (e) {
    console.warn("[clients] decrypt failed:", e.message);
    return "";
  }
}

function normalizeClientExchange(value) {
  const e = String(value || "").trim().toLowerCase();
  if (e === "delta") return "delta";
  return "binance";
}

function maskSecretForDisplay(plain) {
  const s = String(plain || "");
  if (!s) return null;
  if (s.length <= 8) return "****";
  return s.slice(0, 4) + "****" + s.slice(-4);
}

function maskAccountRow(row) {
  if (!row) return row;
  const out = { ...row };
  const apiPlain = decryptClientSecret(out.api_key);
  const secretPlain = decryptClientSecret(out.secret_key);
  out.api_key = maskSecretForDisplay(apiPlain);
  out.secret_key = secretPlain ? "****" + secretPlain.slice(-4) : null;
  out.is_active = false;
  return out;
}

function maskClientWithAccounts(client, accounts) {
  return {
    ...client,
    is_active: false,
    accounts: (accounts || []).map(maskAccountRow),
  };
}

async function encryptExistingPlaintextSecrets(pool) {
  const key = getClientCredentialsKey();
  if (!key) return;
  try {
    const result = await pool.query(
      `SELECT id, api_key, secret_key FROM client_exchange_accounts
       WHERE (api_key IS NOT NULL AND api_key <> '' AND api_key NOT LIKE 'enc:v1:%')
          OR (secret_key IS NOT NULL AND secret_key <> '' AND secret_key NOT LIKE 'enc:v1:%')`
    );
    for (const row of result.rows || []) {
      const api = row.api_key && !isEncryptedClientSecret(row.api_key) ? encryptClientSecret(row.api_key) : row.api_key;
      const secret =
        row.secret_key && !isEncryptedClientSecret(row.secret_key)
          ? encryptClientSecret(row.secret_key)
          : row.secret_key;
      await pool.query(
        `UPDATE client_exchange_accounts SET api_key = $1, secret_key = $2, updated_at = NOW() WHERE id = $3`,
        [api, secret, row.id]
      );
    }
    if ((result.rows || []).length) {
      console.log(`[clients] encrypted ${(result.rows || []).length} legacy plaintext credential row(s)`);
    }
  } catch (e) {
    console.warn("[clients] plaintext re-encrypt skipped:", e.message);
  }
}

async function ensureClientsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id                  SERIAL PRIMARY KEY,
      first_name          TEXT NOT NULL,
      last_name           TEXT NOT NULL,
      phone_number        TEXT,
      email               TEXT UNIQUE,
      telegram_id         TEXT,
      is_active           BOOLEAN NOT NULL DEFAULT FALSE,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;`).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_exchange_accounts (
      id                  SERIAL PRIMARY KEY,
      client_id           INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      exchange            TEXT NOT NULL,
      api_key             TEXT,
      secret_key          TEXT,
      investment          NUMERIC(18, 2) DEFAULT 0,
      is_active           BOOLEAN NOT NULL DEFAULT FALSE,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (client_id, exchange)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active);`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_exchange_accounts_client ON client_exchange_accounts(client_id);`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_exchange_accounts_exchange ON client_exchange_accounts(exchange);`).catch(() => {});

  try {
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clients'
        AND column_name IN ('exchange', 'binance_api_key', 'binance_secret_key', 'investment')
    `);
    const names = new Set((cols.rows || []).map((r) => r.column_name));
    if (names.has("binance_api_key") || names.has("exchange")) {
      await pool.query(`
        INSERT INTO client_exchange_accounts (client_id, exchange, api_key, secret_key, investment, is_active)
        SELECT
          c.id,
          COALESCE(NULLIF(LOWER(TRIM(c.exchange)), ''), 'binance'),
          c.binance_api_key,
          c.binance_secret_key,
          COALESCE(c.investment, 0),
          FALSE
        FROM clients c
        WHERE NOT EXISTS (
          SELECT 1 FROM client_exchange_accounts a WHERE a.client_id = c.id
        )
        ON CONFLICT (client_id, exchange) DO NOTHING
      `);
    }
  } catch (e) {
    console.warn("[clients] legacy migrate skipped:", e.message);
  }

  await encryptExistingPlaintextSecrets(pool);
  await pool.query(`UPDATE clients SET is_active = FALSE WHERE is_active IS DISTINCT FROM FALSE`).catch(() => {});
  await pool.query(`UPDATE client_exchange_accounts SET is_active = FALSE WHERE is_active IS DISTINCT FROM FALSE`).catch(() => {});
}

async function fetchClientAccounts(pool, clientId) {
  const result = await pool.query(
    `SELECT id, client_id, exchange, api_key, secret_key, investment, is_active, created_at, updated_at
     FROM client_exchange_accounts
     WHERE client_id = $1
     ORDER BY exchange ASC`,
    [clientId]
  );
  return result.rows || [];
}

function normalizeAccountsInput(accounts) {
  if (!Array.isArray(accounts)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of accounts) {
    if (!raw || typeof raw !== "object") continue;
    const exchange = normalizeClientExchange(raw.exchange);
    if (seen.has(exchange)) continue;
    seen.add(exchange);
    out.push({
      id: raw.id != null ? parseInt(raw.id, 10) : null,
      exchange,
      api_key: raw.api_key != null ? String(raw.api_key).trim() : "",
      secret_key: raw.secret_key != null ? String(raw.secret_key).trim() : "",
      investment: raw.investment != null && raw.investment !== "" ? Number(raw.investment) : 0,
      is_active: false,
    });
  }
  return out;
}

function prepareSecretForStorage(incoming, existingEncrypted) {
  if (!incoming || isMaskedClientSecret(incoming)) return existingEncrypted || null;
  return encryptClientSecret(incoming);
}

app.get("/api/clients", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ error: "Database not connected", clients: [] });
    await ensureClientsTable(pool);
    const clientsRes = await pool.query(`
      SELECT id, first_name, last_name, phone_number, email, telegram_id, is_active, created_at, updated_at
      FROM clients
      ORDER BY created_at DESC
    `);
    const accountsRes = await pool.query(`
      SELECT id, client_id, exchange, api_key, secret_key, investment, is_active, created_at, updated_at
      FROM client_exchange_accounts
      ORDER BY exchange ASC
    `);
    const byClient = new Map();
    for (const a of accountsRes.rows || []) {
      if (!byClient.has(a.client_id)) byClient.set(a.client_id, []);
      byClient.get(a.client_id).push(a);
    }
    const clients = (clientsRes.rows || []).map((c) =>
      maskClientWithAccounts(c, byClient.get(c.id) || [])
    );
    res.json({ clients });
  } catch (error) {
    if (isMissingTable(error)) return res.json({ clients: [] });
    console.error("❌ Query Error (/api/clients):", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch clients" });
  }
});

app.post("/api/clients", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ error: "Database not connected" });
    if (!getClientCredentialsKey()) {
      return res.status(503).json({
        error: "Server missing CLIENT_CREDENTIALS_KEY — set it in secrets.env to encrypt API keys",
      });
    }
    const { first_name, last_name, phone_number, email, telegram_id, accounts } = req.body || {};
    if (!first_name?.trim() || !last_name?.trim()) {
      return res.status(400).json({ error: "First name and last name are required" });
    }
    const accountList = normalizeAccountsInput(accounts);
    if (!accountList.length) {
      return res.status(400).json({ error: "Add at least one exchange account (Binance or Delta)" });
    }
    await ensureClientsTable(pool);
    const clientRes = await pool.query(
      `INSERT INTO clients (first_name, last_name, phone_number, email, telegram_id, is_active)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING id, first_name, last_name, phone_number, email, telegram_id, is_active, created_at, updated_at`,
      [
        first_name.trim(),
        last_name.trim(),
        phone_number?.trim() || null,
        email?.trim() || null,
        telegram_id?.trim() || null,
      ]
    );
    const client = clientRes.rows[0];
    for (const acc of accountList) {
      await pool.query(
        `INSERT INTO client_exchange_accounts (client_id, exchange, api_key, secret_key, investment, is_active)
         VALUES ($1, $2, $3, $4, $5, FALSE)`,
        [
          client.id,
          acc.exchange,
          prepareSecretForStorage(acc.api_key, null),
          prepareSecretForStorage(acc.secret_key, null),
          Number.isFinite(acc.investment) ? acc.investment : 0,
        ]
      );
    }
    const savedAccounts = await fetchClientAccounts(pool, client.id);
    res.status(201).json({ client: maskClientWithAccounts(client, savedAccounts) });
  } catch (error) {
    if (error.code === "NO_CLIENT_CREDENTIALS_KEY") {
      return res.status(503).json({ error: error.message });
    }
    if (error.code === "23505") {
      return res.status(409).json({
        error: error.constraint?.includes("exchange")
          ? "Duplicate exchange for this client"
          : "Email already exists",
      });
    }
    console.error("❌ Query Error (POST /api/clients):", error.message);
    res.status(500).json({ error: error.message || "Failed to create client" });
  }
});

app.put("/api/clients/:id", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ error: "Database not connected" });
    if (!getClientCredentialsKey()) {
      return res.status(503).json({
        error: "Server missing CLIENT_CREDENTIALS_KEY — set it in secrets.env to encrypt API keys",
      });
    }
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid client id" });
    const { first_name, last_name, phone_number, email, telegram_id, accounts } = req.body || {};
    if (!first_name?.trim() || !last_name?.trim()) {
      return res.status(400).json({ error: "First name and last name are required" });
    }
    const accountList = normalizeAccountsInput(accounts);
    if (!accountList.length) {
      return res.status(400).json({ error: "Add at least one exchange account (Binance or Delta)" });
    }
    await ensureClientsTable(pool);
    const clientRes = await pool.query(
      `UPDATE clients SET
         first_name = $1,
         last_name = $2,
         phone_number = $3,
         email = $4,
         telegram_id = $5,
         is_active = FALSE,
         updated_at = NOW()
       WHERE id = $6
       RETURNING id, first_name, last_name, phone_number, email, telegram_id, is_active, created_at, updated_at`,
      [
        first_name.trim(),
        last_name.trim(),
        phone_number?.trim() || null,
        email?.trim() || null,
        telegram_id?.trim() || null,
        id,
      ]
    );
    if (!clientRes.rows.length) return res.status(404).json({ error: "Client not found" });

    const existing = await fetchClientAccounts(pool, id);
    const keepIds = [];
    for (const acc of accountList) {
      const match =
        (Number.isFinite(acc.id) && existing.find((e) => e.id === acc.id)) ||
        existing.find((e) => e.exchange === acc.exchange);
      if (match) {
        const nextApi = prepareSecretForStorage(acc.api_key, match.api_key);
        const nextSecret = prepareSecretForStorage(acc.secret_key, match.secret_key);
        await pool.query(
          `UPDATE client_exchange_accounts SET
             exchange = $1,
             api_key = $2,
             secret_key = $3,
             investment = $4,
             is_active = FALSE,
             updated_at = NOW()
           WHERE id = $5`,
          [
            acc.exchange,
            nextApi,
            nextSecret,
            Number.isFinite(acc.investment) ? acc.investment : 0,
            match.id,
          ]
        );
        keepIds.push(match.id);
      } else {
        const ins = await pool.query(
          `INSERT INTO client_exchange_accounts (client_id, exchange, api_key, secret_key, investment, is_active)
           VALUES ($1, $2, $3, $4, $5, FALSE)
           RETURNING id`,
          [
            id,
            acc.exchange,
            prepareSecretForStorage(acc.api_key, null),
            prepareSecretForStorage(acc.secret_key, null),
            Number.isFinite(acc.investment) ? acc.investment : 0,
          ]
        );
        keepIds.push(ins.rows[0].id);
      }
    }
    if (keepIds.length) {
      await pool.query(
        `DELETE FROM client_exchange_accounts WHERE client_id = $1 AND NOT (id = ANY($2::int[]))`,
        [id, keepIds]
      );
    } else {
      await pool.query(`DELETE FROM client_exchange_accounts WHERE client_id = $1`, [id]);
    }

    const savedAccounts = await fetchClientAccounts(pool, id);
    res.json({ client: maskClientWithAccounts(clientRes.rows[0], savedAccounts) });
  } catch (error) {
    if (error.code === "NO_CLIENT_CREDENTIALS_KEY") {
      return res.status(503).json({ error: error.message });
    }
    if (error.code === "23505") {
      return res.status(409).json({
        error: error.constraint?.includes("exchange")
          ? "Duplicate exchange for this client"
          : "Email already exists",
      });
    }
    console.error("❌ Query Error (PUT /api/clients/:id):", error.message);
    res.status(500).json({ error: error.message || "Failed to update client" });
  }
});

app.delete("/api/clients/:id", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ error: "Database not connected" });
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid client id" });
    await ensureClientsTable(pool);
    const result = await pool.query(`DELETE FROM clients WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: "Client not found" });
    res.json({ ok: true, id });
  } catch (error) {
    console.error("❌ Query Error (DELETE /api/clients/:id):", error.message);
    res.status(500).json({ error: error.message || "Failed to delete client" });
  }
});

// ✅ API: Fetch Active Loss/Condition flags (e.g., BUY/SELL booleans)
// Expected table: active_loss with columns like buy, sell (bool/int/text) where id=1
const defaultActiveLoss = { id: 1, buy: false, sell: false, buy_condition: false, sell_condition: false, buyflag: false, sellflag: false };
app.get("/api/active-loss", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      const fallback = await fetchFromFallback("/api/active-loss");
      if (fallback && typeof fallback === "object") return res.json(fallback);
      return res.json(defaultActiveLoss);
    }
    const result = await pool.query(`
      SELECT *
      FROM active_loss
      WHERE id = 1
      LIMIT 1;
    `);
    const row = result.rows?.[0] || defaultActiveLoss;
    res.json(row);
  } catch (error) {
    if (error.code === "42P01" || (error.message && error.message.includes("does not exist"))) {
      return res.json(defaultActiveLoss);
    }
    console.error("❌ Query Error (/api/active-loss):", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch active loss flags" });
  }
});

// ✅ API: Auto Execute status (LiveAutoActive table) — buy_active, sell_active
async function ensureLiveAutoActiveColumns(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS liveautoactive (
      id INT PRIMARY KEY DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      buy_active BOOLEAN NOT NULL DEFAULT TRUE,
      sell_active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE liveautoactive ADD COLUMN IF NOT EXISTS buy_active BOOLEAN NOT NULL DEFAULT TRUE;`).catch(() => {});
  await pool.query(`ALTER TABLE liveautoactive ADD COLUMN IF NOT EXISTS sell_active BOOLEAN NOT NULL DEFAULT TRUE;`).catch(() => {});
}

app.get("/api/auto-execute", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json({ buyActive: true, sellActive: true });
    }
    await ensureLiveAutoActiveColumns(pool);
    let result = await pool.query(
      "SELECT buy_active, sell_active FROM liveautoactive WHERE id = 1 LIMIT 1;"
    ).catch(() => ({ rows: [] }));
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      const buyActive = row.buy_active !== undefined ? !!row.buy_active : true;
      const sellActive = row.sell_active !== undefined ? !!row.sell_active : true;
      return res.json({ buyActive, sellActive });
    }
    result = await pool.query(
      "SELECT is_active FROM liveautoactive WHERE id = 1 LIMIT 1;"
    ).catch(() => ({ rows: [] }));
    if (result.rows && result.rows.length > 0) {
      const active = !!result.rows[0].is_active;
      return res.json({ buyActive: active, sellActive: active });
    }
    await pool.query(
      "INSERT INTO liveautoactive (id, is_active, buy_active, sell_active) VALUES (1, TRUE, TRUE, TRUE) ON CONFLICT (id) DO NOTHING;"
    ).catch(() => {});
    const insertSel = await pool.query(
      "SELECT buy_active, sell_active FROM liveautoactive WHERE id = 1 LIMIT 1;"
    ).catch(() => ({ rows: [{ buy_active: true, sell_active: true }] }));
    const row = insertSel.rows && insertSel.rows[0] ? insertSel.rows[0] : { buy_active: true, sell_active: true };
    res.json({
      buyActive: row.buy_active !== undefined ? !!row.buy_active : true,
      sellActive: row.sell_active !== undefined ? !!row.sell_active : true,
    });
  } catch (error) {
    console.error("❌ Query Error (/api/auto-execute):", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch auto execute status" });
  }
});

app.post("/api/auto-execute/set", async (req, res) => {
  if (!(await requireActionPassword(req, res))) return;
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ ok: false, message: "Database not connected" });
    }
    const buyActive = req.body && req.body.buyActive !== undefined ? !!req.body.buyActive : true;
    const sellActive = req.body && req.body.sellActive !== undefined ? !!req.body.sellActive : true;
    await ensureLiveAutoActiveColumns(pool);
    await pool.query(`
      INSERT INTO liveautoactive (id, is_active, buy_active, sell_active, updated_at)
      VALUES (1, $1, $2, $3, NOW())
      ON CONFLICT (id) DO UPDATE SET is_active = $1, buy_active = $2, sell_active = $3, updated_at = NOW();
    `, [buyActive || sellActive, buyActive, sellActive]);
    res.json({ ok: true, buyActive, sellActive });
  } catch (error) {
    console.error("❌ Query Error (/api/auto-execute/set):", error.message);
    res.status(500).json({ ok: false, message: error.message || "Failed to set auto execute" });
  }
});

// ✅ Manage Auto Position — table + GET / toggle
const MANAGE_AUTO_POSITION_TABLE = "manage_auto_position";

async function ensureManageAutoPositionTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MANAGE_AUTO_POSITION_TABLE} (
      id INT PRIMARY KEY DEFAULT 1,
      is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    ALTER TABLE ${MANAGE_AUTO_POSITION_TABLE}
    ADD COLUMN IF NOT EXISTS side TEXT DEFAULT 'BOTH';
  `).catch(() => {});
}

function manageAutoPositionSideFromFlags(buyActive, sellActive) {
  const b = !!buyActive;
  const s = !!sellActive;
  if (b && !s) return "BUY";
  if (!b && s) return "SELL";
  if (b && s) return "BOTH";
  return "NONE";
}

function normalizeManageAutoPositionSide(raw) {
  const u = (raw == null ? "" : String(raw)).trim().toUpperCase();
  if (u === "BUY" || u === "SELL" || u === "BOTH" || u === "NONE") return u;
  return "BOTH";
}

app.get("/api/manage-auto-position", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json({ enabled: false, side: "BOTH" });
    }
    await ensureManageAutoPositionTable(pool);
    const result = await pool.query(
      `SELECT is_enabled, side FROM ${MANAGE_AUTO_POSITION_TABLE} WHERE id = 1 LIMIT 1;`
    ).catch(() => ({ rows: [] }));
    if (result.rows && result.rows.length > 0) {
      const enabled = !!result.rows[0].is_enabled;
      const side = normalizeManageAutoPositionSide(result.rows[0].side);
      return res.json({ enabled, side });
    }
    await pool.query(
      `INSERT INTO ${MANAGE_AUTO_POSITION_TABLE} (id, is_enabled, side) VALUES (1, FALSE, 'BOTH') ON CONFLICT (id) DO NOTHING;`
    ).catch(() => {});
    res.json({ enabled: false, side: "BOTH" });
  } catch (error) {
    console.error("❌ Query Error (/api/manage-auto-position):", error.message);
    res.status(500).json({ enabled: false, side: "BOTH" });
  }
});

app.post("/api/manage-auto-position/toggle", async (req, res) => {
  if (!(await requireActionPassword(req, res))) return;
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ ok: false, message: "Database not connected" });
    }
    await ensureManageAutoPositionTable(pool);
    const body = req.body || {};
    const hasSideFlags =
      typeof body.buyActive === "boolean" && typeof body.sellActive === "boolean";
    const sideFromBody = hasSideFlags
      ? manageAutoPositionSideFromFlags(body.buyActive, body.sellActive)
      : null;

    const current = await pool.query(
      `SELECT is_enabled, side FROM ${MANAGE_AUTO_POSITION_TABLE} WHERE id = 1 LIMIT 1;`
    ).catch(() => ({ rows: [] }));
    const nowEnabled = current.rows && current.rows.length > 0 ? !current.rows[0].is_enabled : true;

    if (sideFromBody != null) {
      await pool.query(
        `INSERT INTO ${MANAGE_AUTO_POSITION_TABLE} (id, is_enabled, side, updated_at) VALUES (1, $1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET is_enabled = $1, side = $2, updated_at = NOW();`,
        [nowEnabled, sideFromBody]
      );
    } else {
      await pool.query(
        `INSERT INTO ${MANAGE_AUTO_POSITION_TABLE} (id, is_enabled, updated_at) VALUES (1, $1, NOW())
         ON CONFLICT (id) DO UPDATE SET is_enabled = $1, updated_at = NOW();`,
        [nowEnabled]
      );
    }

    const sideRow = await pool.query(
      `SELECT side FROM ${MANAGE_AUTO_POSITION_TABLE} WHERE id = 1 LIMIT 1;`
    ).catch(() => ({ rows: [] }));
    const side =
      sideRow.rows && sideRow.rows.length > 0
        ? normalizeManageAutoPositionSide(sideRow.rows[0].side)
        : "BOTH";
    res.json({ ok: true, enabled: nowEnabled, side });
  } catch (error) {
    console.error("❌ Query Error (/api/manage-auto-position/toggle):", error.message);
    res.status(500).json({ ok: false, message: error.message || "Failed to toggle" });
  }
});

app.post("/api/manage-auto-position/set-side", async (req, res) => {
  if (!(await requireActionPassword(req, res))) return;
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ ok: false, message: "Database not connected" });
    }
    await ensureManageAutoPositionTable(pool);
    const body = req.body || {};
    const buyActive = !!body.buyActive;
    const sellActive = !!body.sellActive;
    const side = manageAutoPositionSideFromFlags(buyActive, sellActive);
    await pool.query(
      `INSERT INTO ${MANAGE_AUTO_POSITION_TABLE} (id, is_enabled, side, updated_at)
       VALUES (1, FALSE, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET side = $1, updated_at = NOW();`,
      [side]
    );
    res.json({ ok: true, side, buyActive, sellActive });
  } catch (error) {
    console.error("❌ Query Error (/api/manage-auto-position/set-side):", error.message);
    res.status(500).json({ ok: false, message: error.message || "Failed to set side" });
  }
});

// ✅ Binance Proxy Endpoint (local/cloud server)
const LOCAL_PROXY = `http://localhost:${process.env.PORT || 10000}/api/klines`;

app.get('/api/klines', async (req, res) => {
  try {
    const { symbol, interval, limit } = req.query;
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit || 200}`;
    const { data } = await axios.get(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

function getPythonSignalsUrl() {
  return (process.env.PYTHON_SIGNALS_URL || "http://localhost:5001").replace(/\/$/, "");
}

async function proxyGetToPython(req, res, timeoutMs) {
  const pythonUrl = getPythonSignalsUrl();
  try {
    const qs = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    const url = `${pythonUrl}${req.path}${qs}`;
    const ms =
      typeof timeoutMs === "number" && timeoutMs > 0
        ? timeoutMs
        : Number(process.env.PYTHON_PROXY_TIMEOUT_MS) || 60000;
    const { data, status } = await axios.get(url, { timeout: ms, validateStatus: () => true });
    res.status(status || 200).json(data);
  } catch (err) {
    console.error(`[${req.path}] Python proxy error:`, err.message);
    res.status(502).json({ ok: false, message: err.message || "Python signals service unavailable" });
  }
}

async function proxyPostToPython(req, res, timeoutMs = 60000) {
  const pythonUrl = getPythonSignalsUrl();
  try {
    const url = `${pythonUrl}${req.path}`;
    const { data, status } = await axios.post(url, req.body || {}, {
      headers: { "Content-Type": "application/json" },
      timeout: timeoutMs,
      validateStatus: () => true,
    });
    res.status(status || 200).json(data);
  } catch (err) {
    console.error(`[${req.path}] Python proxy error:`, err.message);
    res.status(502).json({ ok: false, message: err.message || "Python signals service unavailable" });
  }
}

/** Login password or lab_settings.action_password. Returns false if response already sent. */
async function requireActionPassword(req, res) {
  const pw = (req.body?.password || "").toString().trim();
  if (!pw) {
    res.status(400).json({ ok: false, message: "password required" });
    return false;
  }
  try {
    const pool = await poolPromise;
    if (!pool) {
      res.status(503).json({ ok: false, message: "Database not connected" });
      return false;
    }
    try {
      const setting = await pool.query(`SELECT value FROM lab_settings WHERE key = 'action_password' LIMIT 1`);
      const actionPw = setting?.rows?.[0]?.value;
      if (actionPw != null && String(actionPw).trim() !== "" && pw === String(actionPw).trim()) return true;
    } catch (_) { /* table may not exist */ }
    if (req.user?.email) {
      const userRes = await pool.query(
        `SELECT id FROM users
         WHERE email = $1 AND is_active = TRUE AND password_hash = crypt($2, password_hash)`,
        [req.user.email, pw]
      );
      if (userRes.rowCount > 0) return true;
    }
    res.status(401).json({ ok: false, message: "Invalid password" });
    return false;
  } catch (e) {
    log(`requireActionPassword error: ${e.message}`, "ERROR");
    res.status(500).json({ ok: false, message: "Password check failed" });
    return false;
  }
}

async function proxyActionToPython(req, res, timeoutMs = 120000) {
  if (!(await requireActionPassword(req, res))) return;
  return proxyPostToPython(req, res, timeoutMs);
}

// Python-backed read endpoints (Information + Binance Data sections)
app.get("/api/open-position", proxyGetToPython);
app.get("/api/open-orders", proxyGetToPython);
app.get("/api/futures-balance", proxyGetToPython);
app.get("/api/income-history", (req, res) => {
  const sync = String(req.query.sync || "").toLowerCase();
  const ms = ["1", "true", "yes"].includes(sync) ? 120000 : 30000;
  return proxyGetToPython(req, res, ms);
});
app.get("/api/sync-open-positions", (req, res) => proxyPostToPython(req, res, 120000));
app.post("/api/sync-open-positions", (req, res) => proxyPostToPython(req, res, 120000));

// ✅ Proxy to Python CalculateSignals API (run python/api_signals.py; set PYTHON_SIGNALS_URL=http://localhost:5001)
app.post("/api/calculate-signals", async (req, res) => {
  const pythonUrl = getPythonSignalsUrl();
  try {
    console.log("[calculate-signals] Request body:", JSON.stringify(req.body));
    const timeoutMs = Number(process.env.CALCULATE_SIGNALS_TIMEOUT_MS) || 300000; // 5 min default (4 intervals can be slow)
    const { data, status } = await axios.post(`${pythonUrl}/api/calculate-signals`, req.body, {
      headers: { "Content-Type": "application/json" },
      timeout: timeoutMs,
      validateStatus: () => true,
    });
    console.log("[calculate-signals] Python API response:", JSON.stringify(data, null, 2));
    res.status(status || 200).json(data);
  } catch (err) {
    console.error("[calculate-signals] Proxy error:", err.message);
    res.status(502).json({ ok: false, message: err.message || "Python signals service unavailable" });
  }
});

// ✅ POST /api/trade-management-rule — Proxy to Python (upsert trade_management_rules: profit target, partial stop, hedge price)
app.post("/api/trade-management-rule", async (req, res) => {
  const pythonUrl = getPythonSignalsUrl();
  try {
    console.log("[DEBUG] trade-management-rule | server received:", req.body && { ...req.body, password: req.body.password ? "***" : undefined });
    const { data, status } = await axios.post(`${pythonUrl}/api/trade-management-rule`, req.body || {}, {
      headers: { "Content-Type": "application/json" },
      timeout: 20000,
      validateStatus: () => true,
    });
    console.log("[DEBUG] trade-management-rule | Python response:", data);
    res.status(status || 200).json(data);
  } catch (err) {
    console.error("[trade-management-rule] Proxy error:", err.message);
    res.status(502).json({ ok: false, message: err.message || "Python signals service unavailable" });
  }
});

// Trading actions: Node checks password, then proxies to Python api_signals.py
app.post("/api/execute", (req, res) => proxyActionToPython(req, res, 120000));
app.post("/api/hedge", (req, res) => proxyActionToPython(req, res, 120000));
app.post("/api/partial-close", (req, res) => proxyActionToPython(req, res, 120000));
app.post("/api/stop-price", (req, res) => proxyActionToPython(req, res, 120000));
app.post("/api/end-trade", (req, res) => proxyActionToPython(req, res, 120000));
app.post("/api/add-investment", (req, res) => proxyActionToPython(req, res, 120000));
app.post("/api/close-order", (req, res) => proxyActionToPython(req, res, 60000));
app.get("/api/close-order", proxyGetToPython);
app.get("/api/quantity-preview", proxyGetToPython);
app.post("/api/quantity-preview", (req, res) => proxyPostToPython(req, res, 20000));
app.get("/api/set-all-stop-preview", proxyGetToPython);
app.post("/api/set-all-stop-one", (req, res) => proxyActionToPython(req, res, 120000));

// ✅ API: Fetch Signal Processing Logs with Pagination and Filtering
app.get("/api/SignalProcessingLogs", async (req, res) => {
  try {
    console.log("🔍 [SignalProcessingLogs] Request received:", req.query);
    const pool = await poolPromise;
    if (!pool) throw new Error("Database not connected");
    
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = req.query.limit === 'all' ? 'all' : (parseInt(req.query.limit) || 50);
    const offset = (page - 1) * (limit === 'all' ? 0 : limit);
    
    // Build WHERE clause for filters
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    // Symbol filter
    if (req.query.symbol) {
      whereConditions.push(`symbol LIKE $${paramIndex}`);
      params.push(`%${req.query.symbol}%`);
      paramIndex++;
    }
    // Signal type filter
    if (req.query.signalType) {
      whereConditions.push(`signal_type LIKE $${paramIndex}`);
      params.push(`%${req.query.signalType}%`);
      paramIndex++;
    }
    // Machine filter
    if (req.query.machineId) {
      whereConditions.push(`machine_id = $${paramIndex}`);
      params.push(req.query.machineId);
      paramIndex++;
    }
    // Date range filter
    if (req.query.fromDate) {
      whereConditions.push(`candle_time >= $${paramIndex}`);
      params.push(req.query.fromDate);
      paramIndex++;
    }
    if (req.query.toDate) {
      whereConditions.push(`candle_time <= $${paramIndex}`);
      params.push(req.query.toDate);
      paramIndex++;
    }
    // RSI range filter (from json_data, so not filterable in SQL directly)
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // --- Sorting logic ---
    const allowedSortKeys = [
      'candle_time', 'symbol', 'interval', 'signal_type', 'signal_source', 'candle_pattern', 'price',
      'squeeze_status', 'active_squeeze', 'processing_time_ms', 'machine_id', 'timestamp', 'created_at', 'unique_id'
    ];
    let sortKey = req.query.sortKey;
    let sortDirection = req.query.sortDirection && req.query.sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    if (!allowedSortKeys.includes(sortKey)) {
      sortKey = 'candle_time';
    }
    const orderByClause = `ORDER BY ${sortKey} ${sortDirection}`;
    
    // Build the query
    const countQuery = `SELECT COUNT(*) as total FROM signalprocessinglogs ${whereClause}`;
    const dataQuery = `
      SELECT 
        id,
        candle_time,
        symbol,
        interval,
        signal_type,
        signal_source,
        candle_pattern,
        price,
        squeeze_status,
        active_squeeze,
        processing_time_ms,
        machine_id,
        timestamp,
        json_data,
        created_at,
        unique_id
      FROM signalprocessinglogs 
      ${whereClause}
      ${orderByClause}
      ${limit === 'all' ? '' : `LIMIT ${limit} OFFSET ${offset}`}
    `;
    
    // Execute queries
    console.log("🔍 [SignalProcessingLogs] Count query:", countQuery);
    console.log("🔍 [SignalProcessingLogs] Data query:", dataQuery);
    console.log("🔍 [SignalProcessingLogs] Parameters:", params);
    
    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, params)
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    const logs = dataResult.rows;
    
    console.log("🔍 [SignalProcessingLogs] Total records:", total);
    console.log("🔍 [SignalProcessingLogs] Fetched logs:", logs.length);
    
    // Parse JSON data for each log and extract extra fields
    const processedLogs = logs.map(log => {
      let extra = {};
      if (log.json_data) {
        try {
          const json = JSON.parse(log.json_data);
          extra = {
            rsi: json.rsi,
            macd: json.macd,
            trend: json.trend,
            action: json.action,
            status: json.status,
            // add more as needed
          };
        } catch (e) {}
      }
      return { ...log, ...extra };
    });
    
    console.log("🔍 [SignalProcessingLogs] Sending response with", processedLogs.length, "logs");
    res.json({
      logs: processedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: limit === 'all' ? 1 : Math.ceil(total / limit),
        hasNext: limit === 'all' ? false : page < Math.ceil(total / limit),
        hasPrev: limit === 'all' ? false : page > 1
      }
    });
    
  } catch (error) {
    console.error("❌ [SignalProcessingLogs] Error:", error);
    console.error("❌ [SignalProcessingLogs] Error stack:", error.stack);
    res.status(500).json({ error: error.message || "Failed to fetch signal processing logs" });
  }
});

// ✅ API: Fetch Bot Event Logs with Pagination and Filtering
app.get("/api/bot-event-logs", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) throw new Error("Database not connected");
    
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = req.query.limit === 'all' ? 'all' : (parseInt(req.query.limit) || 50);
    const offset = (page - 1) * (limit === 'all' ? 0 : limit);
    
    // Build WHERE clause for filters
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    // UID filter (exact match)
    if (req.query.uid) {
      whereConditions.push(`uid = $${paramIndex}`);
      params.push(req.query.uid);
      paramIndex++;
    }
    
    // Source filter
    if (req.query.source) {
      whereConditions.push(`source LIKE $${paramIndex}`);
      params.push(`%${req.query.source}%`);
      paramIndex++;
    }
    
    // Machine filter
    if (req.query.machineId) {
      whereConditions.push(`machine_id = $${paramIndex}`);
      params.push(req.query.machineId);
      paramIndex++;
    }
    
    // Date range filter
    if (req.query.fromDate) {
      whereConditions.push(`timestamp >= $${paramIndex}`);
      params.push(req.query.fromDate);
      paramIndex++;
    }
    if (req.query.toDate) {
      whereConditions.push(`timestamp <= $${paramIndex}`);
      params.push(req.query.toDate);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // --- Sorting logic ---
    const allowedSortKeys = [
      'id', 'uid', 'source', 'pl_after_comm', 'plain_message', 'timestamp', 'machine_id'
    ];
    let sortKey = req.query.sortKey;
    let sortDirection = req.query.sortDirection && req.query.sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    if (!allowedSortKeys.includes(sortKey)) {
      sortKey = 'timestamp';
    }
    const orderByClause = `ORDER BY ${sortKey} ${sortDirection}`;
    
    // Build the query
    const countQuery = `SELECT COUNT(*) as total FROM bot_event_log ${whereClause}`;
    const dataQuery = `
      SELECT 
        id,
        uid,
        source,
        pl_after_comm,
        plain_message,
        json_message,
        timestamp,
        machine_id
      FROM bot_event_log 
      ${whereClause}
      ${orderByClause}
      ${limit === 'all' ? '' : `LIMIT ${limit} OFFSET ${offset}`}
    `;
    
    // Execute queries
    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, params)
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    const logs = dataResult.rows;
    
    // Parse JSON message for each log if needed
    const processedLogs = logs.map(log => {
      let parsedJson = null;
      if (log.json_message) {
        try {
          parsedJson = JSON.parse(log.json_message);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      return { 
        ...log, 
        parsed_json_message: parsedJson 
      };
    });
    
    res.json({
      logs: processedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: limit === 'all' ? 1 : Math.ceil(total / (limit === 'all' ? total : limit)),
        hasNext: limit === 'all' ? false : page < Math.ceil(total / (limit === 'all' ? total : limit)),
        hasPrev: limit === 'all' ? false : page > 1
      }
    });
    
  } catch (error) {
    console.error("\u274c Query Error (/api/bot-event-logs):", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch bot event logs" });
  }
});

// ✅ API: Get Log Summary Statistics
app.get("/api/SignalProcessingLogs/summary", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) throw new Error("Database not connected");
    
    // Build WHERE clause for filters (same as above)
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    if (req.query.symbol) {
      whereConditions.push(`symbol LIKE $${paramIndex}`);
      params.push(`%${req.query.symbol}%`);
      paramIndex++;
    }
    if (req.query.signalType) {
      whereConditions.push(`signal_type LIKE $${paramIndex}`);
      params.push(`%${req.query.signalType}%`);
      paramIndex++;
    }
    if (req.query.machineId) {
      whereConditions.push(`machine_id = $${paramIndex}`);
      params.push(req.query.machineId);
      paramIndex++;
    }
    if (req.query.fromDate) {
      whereConditions.push(`candle_time >= $${paramIndex}`);
      params.push(req.query.fromDate);
      paramIndex++;
    }
    if (req.query.toDate) {
      whereConditions.push(`candle_time <= $${paramIndex}`);
      params.push(req.query.toDate);
      paramIndex++;
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get all logs for summary (for small/medium datasets; for large, optimize with SQL aggregation)
    const summaryQuery = `
      SELECT 
        signal_type,
        json_data
      FROM signalprocessinglogs 
      ${whereClause}
    `;
    const result = await pool.query(summaryQuery, params);
    const logs = result.rows;
    let totalLogs = logs.length;
    let buyCount = 0;
    let sellCount = 0;
    let rsiSum = 0;
    let rsiCount = 0;
    let earliestLog = null;
    let latestLog = null;
    let uniqueSymbols = new Set();
    let uniqueMachines = new Set();
    logs.forEach(log => {
      if (log.signal_type === 'BUY') buyCount++;
      if (log.signal_type === 'SELL') sellCount++;
      if (log.json_data) {
        try {
          const json = JSON.parse(log.json_data);
          if (json.rsi !== undefined && json.rsi !== null) {
            rsiSum += Number(json.rsi);
            rsiCount++;
          }
        } catch (e) {}
      }
    });
    const avgRSI = rsiCount > 0 ? (rsiSum / rsiCount).toFixed(2) : null;
    res.json({
      summary: {
        totalLogs,
        buyCount,
        sellCount,
        avgRSI,
        uniqueSymbols: uniqueSymbols.size,
        uniqueMachines: uniqueMachines.size,
        earliestLog,
        latestLog
      }
    });
  } catch (error) {
    console.error("❌ Query Error (/api/SignalProcessingLogs/summary):", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch summary" });
  }
});

// ✅ API: Get Bot Event Log Summary Statistics
app.get("/api/bot-event-logs/summary", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) throw new Error("Database not connected");
    
    // Build WHERE clause for filters (same as above)
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (req.query.uid) {
      whereConditions.push(`uid = $${paramIndex}`);
      params.push(req.query.uid);
      paramIndex++;
    }
    if (req.query.source) {
      whereConditions.push(`source LIKE $${paramIndex}`);
      params.push(`%${req.query.source}%`);
      paramIndex++;
    }
    if (req.query.machineId) {
      whereConditions.push(`machine_id = $${paramIndex}`);
      params.push(req.query.machineId);
      paramIndex++;
    }
    if (req.query.fromDate) {
      whereConditions.push(`timestamp >= $${paramIndex}`);
      params.push(req.query.fromDate);
      paramIndex++;
    }
    if (req.query.toDate) {
      whereConditions.push(`timestamp <= $${paramIndex}`);
      params.push(req.query.toDate);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as totalLogs,
        COUNT(DISTINCT machine_id) as uniqueMachines,
        COUNT(DISTINCT source) as uniqueSources,
        SUM(CASE WHEN pl_after_comm > 0 THEN 1 ELSE 0 END) as positivePLCount,
        SUM(CASE WHEN pl_after_comm < 0 THEN 1 ELSE 0 END) as negativePLCount,
        SUM(CASE WHEN pl_after_comm = 0 THEN 1 ELSE 0 END) as zeroPLCount,
        AVG(pl_after_comm) as avgPL,
        MIN(timestamp) as earliestLog,
        MAX(timestamp) as latestLog
      FROM bot_event_log 
      ${whereClause}
    `;
    
    const result = await pool.query(summaryQuery, params);
    const summary = result.rows[0];
    
    res.json({
      summary: {
        totalLogs: summary.totalLogs,
        uniqueMachines: summary.uniqueMachines,
        uniqueSources: summary.uniqueSources,
        positivePLCount: summary.positivePLCount,
        negativePLCount: summary.negativePLCount,
        zeroPLCount: summary.zeroPLCount,
        avgPL: summary.avgPL ? parseFloat(summary.avgPL).toFixed(2) : 0,
        earliestLog: summary.earliestLog,
        latestLog: summary.latestLog
      }
    });
  } catch (error) {
    console.error("❌ Query Error (/api/bot-event-logs/summary):", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch bot event log summary" });
  }
});

// ✅ API: Fetch Trades with Pair Filter
app.get("/api/trades/filtered", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      const qs = Object.entries(req.query).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
      const fallback = await fetchFromFallback("/api/trades/filtered", qs);
      if (fallback && (fallback.trades || Array.isArray(fallback.trades))) return res.json(fallback);
      return res.json({ trades: [] });
    }
    const { pair, limit = 1000 } = req.query;
    let query = "SELECT * FROM alltraderecords";
    let params = [];
    let paramIndex = 1;
    
    if (pair) {
      query += ` WHERE pair = $${paramIndex}`;
      params.push(pair);
      paramIndex++;
    }
    
    query += " ORDER BY created_at DESC";
    
    if (limit && limit !== 'all') {
      query += ` LIMIT ${parseInt(limit)}`;
    }
    
    const result = await pool.query(query, params);
    console.log(`[Server] Fetched ${result.rows.length} trades for pair: ${pair || 'all'}`);
    
    res.json({ trades: result.rows });
  } catch (error) {
    console.error("❌ Query Error (/api/trades/filtered):", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch filtered trades" });
  }
});

// ✅ API: Fetch SignalProcessingLogs with Unique_id only (paginated)
app.get("/api/SignalProcessingLogsWithUniqueId", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) throw new Error("Database not connected");

    let { symbols, page = 1, limit = 100, sortKey, sortDirection = 'ASC' } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    if (!symbols) return res.status(400).json({ error: "Missing symbols param" });
    const symbolList = symbols.split(",").map(s => s.trim()).filter(Boolean);
    if (!symbolList.length) return res.status(400).json({ error: "No symbols provided" });

    // Define allowed sort keys to prevent SQL injection
    const allowedSortKeys = [
      'candle_time', 'symbol', 'interval', 'signal_type', 'signal_source', 
      'candle_pattern', 'price', 'squeeze_status', 'active_squeeze', 
      'machine_id', 'timestamp', 'processing_time_ms', 'created_at', 'unique_id'
    ];

    // Build WHERE clause for symbols and Unique_id (PostgreSQL trims whitespace)
    const symbolPlaceholders = symbolList.map((_, i) => `$${i + 1}`).join(",");
    const whereClause = `symbol IN (${symbolPlaceholders}) AND unique_id IS NOT NULL AND TRIM(unique_id) <> ''`;

    // Build ORDER BY clause
    let orderByClause = 'ORDER BY created_at DESC';
    if (sortKey && allowedSortKeys.includes(sortKey)) {
      orderByClause = `ORDER BY ${sortKey} ${sortDirection === 'ASC' ? 'ASC' : 'DESC'}`;
    }

    // Get total count for pagination (primary query)
    const countQuery = `SELECT COUNT(*) as total FROM signalprocessinglogs WHERE ${whereClause}`;
    const countResult = await pool.query(countQuery, symbolList);
    let total = parseInt(countResult.rows[0]?.total) || 0;
    let totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Fetch paginated logs (primary query)
    const logsQuery = `SELECT * FROM signalprocessinglogs WHERE ${whereClause} ${orderByClause} LIMIT $${symbolList.length + 1} OFFSET $${symbolList.length + 2}`;
    const logsParams = [...symbolList, limit, offset];
    const logsResult = await pool.query(logsQuery, logsParams);

    let filteredLogs = logsResult.rows.filter(
      log => typeof log.unique_id === 'string' && log.unique_id.replace(/\s|\u00A0/g, '').length > 0
    );

    // If no results, run fallback query (BUY/SELL signal_type)
    let usedFallback = false;
    if (filteredLogs.length === 0) {
      usedFallback = true;
      // Fallback count
      const fallbackCountQuery = `SELECT COUNT(*) as total FROM signalprocessinglogs WHERE symbol IN (${symbolPlaceholders}) AND (signal_type = 'BUY' OR signal_type = 'SELL')`;
      const fallbackCountResult = await pool.query(fallbackCountQuery, symbolList);
      total = parseInt(fallbackCountResult.rows[0]?.total) || 0;
      totalPages = Math.ceil(total / limit);
      // Fallback logs
      const fallbackQuery = `SELECT * FROM signalprocessinglogs WHERE symbol IN (${symbolPlaceholders}) AND (signal_type = 'BUY' OR signal_type = 'SELL') ${orderByClause} LIMIT $${symbolList.length + 1} OFFSET $${symbolList.length + 2}`;
      const fallbackParams = [...symbolList, limit, offset];
      const fallbackResult = await pool.query(fallbackQuery, fallbackParams);
      filteredLogs = fallbackResult.rows;
    }

    res.json({
      logs: filteredLogs,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        usedFallback
      }
    });
  } catch (error) {
    console.error("❌ Query Error (/api/SignalProcessingLogsWithUniqueId):", error);
    res.status(500).json({ error: error.message || "Failed to fetch logs with Unique_id" });
  }
});

// ✅ API: Fetch SignalProcessingLogs by a list of UIDs
app.get("/api/SignalProcessingLogsByUIDs", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) throw new Error("Database not connected");
    let { uids } = req.query;
    if (!uids) return res.status(400).json({ error: "Missing uids param" });
    const uidList = uids.split(",").map(u => u.trim()).filter(Boolean);
    if (!uidList.length) return res.status(400).json({ error: "No UIDs provided" });

    const uidPlaceholders = uidList.map((_, i) => `$${i + 1}`).join(",");
    const query = `SELECT * FROM signalprocessinglogs WHERE unique_id IN (${uidPlaceholders})`;
    const result = await pool.query(query, uidList);

    res.json({ logs: result.rows });
  } catch (error) {
    console.error("❌ Query Error (/api/SignalProcessingLogsByUIDs):", error);
    res.status(500).json({ error: error.message || "Failed to fetch logs by UIDs" });
  }
});

// ✅ Serve frontend (dashboard) from dist when present
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"), (err) => err && next());
  });
}

// ✅ Start Express Server
app.listen(PORT, () => {
  log(`server.js STARTED | http://localhost:${PORT}`);
});
const http = require("http");

// Crash handlers — log and optional Telegram
process.on("uncaughtException", (err) => {
  const msg = `[server.js] CRASH uncaughtException: ${err.message}`;
  log(msg, "ERROR");
  sendTelegramSync(msg);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  const msg = `[server.js] CRASH unhandledRejection: ${String(reason)}`;
  log(msg, "ERROR");
  sendTelegramSync(msg);
  process.exit(1);
});
process.on("SIGTERM", () => {
  log("[server.js] Exiting (SIGTERM)");
  process.exit(0);
});
process.on("SIGINT", () => {
  log("[server.js] Exiting (SIGINT)");
  process.exit(0);
});

// Self-ping this server (cloud local) to keep warm — gated by env
if (ENABLE_SELF_PING) {
  const pingUrl = `http://127.0.0.1:${PORT}/api/health`;
  setInterval(() => {
    http.get(pingUrl, (res) => {
      if (VERBOSE_LOG) console.log(`📡 Self-ping status: ${res.statusCode}`);
    }).on("error", (err) => {
      console.error("❌ Self-ping failed:", err.message);
    });
  }, 14 * 60 * 1000); // 14 minutes
}
