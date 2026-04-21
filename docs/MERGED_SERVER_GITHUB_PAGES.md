# Merged server: new file + GitHub Pages data fix

The **server.example.js** in the repo now combines:

1. **Behavior from your new server file** (the one you had uploaded to the cloud):
   - Secrets from `SECRETS_FILE`, `./secrets.env`, `../secrets.env`, `/etc/lab-trading-dashboard.secrets.env`
   - `log()` and `sendTelegramSync()` helpers
   - **Auth**: cookie `lab_session`, login with `password_hash = crypt()`, lockout (failed_attempts, locked_until), logout, `/auth/me`, `/auth/extend-session`
   - **Auth gate**: most `/api/*` and `/auth/me` require login
   - `/api/server-info`, tunnel-url with log fallback, crash handlers (uncaughtException, unhandledRejection, SIGTERM, SIGINT)

2. **GitHub Pages “show data” fix** (why the new file alone hid data):
   - **Public data paths** (no login): `/api/trades`, `/api/machines`, `/api/trade`, `/api/debug`, `/api/supertrend`, `/api/alert-rule-books`
   - So the dashboard on GitHub Pages can load trades/machines/trade/debug without being logged in.

3. **Security and DB** (no credentials in repo):
   - No hardcoded DB password; use `DB_PASSWORD` or `DATABASE_URL` in env only.
   - When `DATABASE_URL` host is `150.241.244.130`, it is rewritten to `127.0.0.1` so the app connects to local Postgres.

4. **Cookie for cross-origin (GitHub Pages)**:
   - In production, session cookie uses `sameSite: "none"` and `secure: true` so the browser sends it to `api.clubinfotech.com` from `loveleet.github.io`.

---

## Deploy to cloud

From your Mac (with `.env` containing `DEPLOY_HOST` and `DEPLOY_PASSWORD`):

```bash
cd lab-trading-dashboard
./scripts/deploy-server-example-to-cloud.sh
```

Or on the cloud:

```bash
cp /root/lab-trading-dashboard/server/server.example.js /root/lab-trading-dashboard/server/server.js
sudo systemctl restart lab-trading-dashboard
```

---

## What stays public (no auth)

- `/api/health`, `/api/server-info`, `/api/tunnel-url`, `/api/alert-rule-books` (and stubs)
- **Data for GitHub Pages:** `/api/trades`, `/api/machines`, `/api/trade`, `/api/debug`, `/api/supertrend`
- When `ALLOW_PUBLIC_READ_SIGNALS=true`: `/api/pairstatus`, `/api/active-loss`, `/api/open-position`, `/api/calculate-signals`

Everything else under `/api/` and `/auth/me` requires a valid session cookie (login first).
