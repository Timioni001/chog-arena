# Owner console (`/admin`)

The console at `https://chog-arena.online/admin` is for the project owner only. It shows how the game is doing and how much it earns, and holds the live-ops switches.

## What's in it

| Tab | What you get |
|---|---|
| **Overview** | Players today (vs yesterday), weekly and monthly uniques, stickiness, matches today, 30-day revenue, daily actives chart, D1/D7/D30 retention against targets, matches by mode, the player funnel, win rate by mode, Spark sources vs sinks, daily cohort table with CSV export |
| **Income** | Pass sales, your withdrawable MON share (with a one-click `withdrawTreasury`), shop sales in $CHOG, $CHOG burned, daily revenue charts, where pass and shop money goes, treasury and prize-vault balances, a verified feed of recent purchases |
| **Players** | Chog holders, ranked players, clans, flags; search by token id or wallet; flag, unflag and reset display names; season top 25 |
| **Live ops** | The announcement banner every player sees, the ranked kill switch, season countdown, prize payout status (claim list published, root onchain), and a log of every admin sign-in and action |
| **System** | Database and RPC latency, which secrets are set (never their values), contract addresses, and which access layers are active |

Where the numbers come from:

- **Players and retention** come from first-party events (`/api/events`), counted per device in Redis. Weekly and monthly uniques use HyperLogLog, so they are exact to within about 1%.
- **Matches and win rates** are counted on the server after replay verification. The client cannot inflate them.
- **Income** is read from the contracts on every load. Totals are correct even for purchases made outside the app. Each load also saves a daily snapshot, and the daily charts are the difference between snapshots. A day nobody opened the console rolls into the next day's bar. The "Recent purchases" feed lists transactions the app reported; the server re-reads each receipt and keeps only events from your own contracts.

## Locking it down

There are three layers. Use all three on the live domain.

### 1. Admin token (always on)

The `ADMIN_TOKEN` Worker secret, at least 16 characters (`openssl rand -hex 24`). Signing in exchanges it for an 8-hour `httpOnly`, `Secure`, `SameSite=Strict` cookie, so the token never sits in browser storage. Five wrong tries lock that IP out for 15 minutes, and every attempt is logged on the Live ops tab. Rotating `ADMIN_TOKEN` signs out every browser at once.

Scripts such as `npm run prizes:build -- --publish` still send `Authorization: Bearer $ADMIN_TOKEN`.

### 2. Wallet allowlist (recommended)

Add a Worker secret `ADMIN_ADDRESSES` with your wallet address (comma-separate several). Once it is set, signing in also needs that wallet signed in to the game (Profile, then Sign in) in the same browser. A leaked token alone is then useless.

### 3. Cloudflare Access (recommended)

Access puts a Cloudflare login page in front of the console, so nobody else even reaches it.

1. Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. Application domain: `chog-arena.online`, path `admin`. Add a second public hostname: `chog-arena.online`, path `api/admin`.
3. Policy: **Allow**, Include → **Emails** → your email.
4. Login methods: **One-time PIN** (a code is emailed to you). No identity provider is needed.
5. Save. The System tab shows "Cloudflare Access on" once requests arrive through it.

To keep `prizes:build --publish` working from your machine, add a **Service Auth** policy with a service token and send its `CF-Access-Client-Id` / `CF-Access-Client-Secret` headers. Or publish from a browser session instead.

Access covers the custom domain only. The `*.workers.dev` URL is still guarded by layers 1 and 2. To close it completely, set `"workers_dev": false` in `wrangler.jsonc` once the custom domain is the only URL you share.

## Live ops

- **Announcement**: up to 160 characters, tone `event`, `info` or `warn`, for N hours or until cleared. Players can dismiss it on their device; a new announcement shows again.
- **Ranked kill switch**: stops new ranked matches (matches already running still finish) and shows a maintenance banner. Practice and campaign keep working.

## API

All admin endpoints accept the admin cookie or `Authorization: Bearer $ADMIN_TOKEN`. Cookie writes must come from the same origin.

| Endpoint | Use |
|---|---|
| `POST/DELETE /api/admin/session` | sign in / out |
| `GET /api/admin/stats` | 37 days of daily stats, reach, flags, player counts |
| `GET /api/admin/income` | onchain income, daily series, purchase feed, payout status |
| `GET/POST /api/admin/players` | search; `{ action: 'reset_name', tokenId }` |
| `POST/DELETE /api/admin/flags` | flag or clear a Chog |
| `GET/POST /api/admin/ops` | announcement, ranked pause, audit log |
| `GET /api/admin/system` | health and configuration |
| `POST /api/admin/claims` | publish a season prize list |
