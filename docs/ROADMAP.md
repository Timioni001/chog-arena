# Launch roadmap

Benchmarked against the reference games (Marvel Snap for battles; Hamster Kombat, Catizen, Pixelverse for the tap loop) and standard mobile launch checklists.

## Must ship before launch

| # | Item | Status |
|---|---|---|
| 1 | Season-end prize pipeline (root builder, proofs API, in-game claim) | ✅ Shipped; verified end to end on a mainnet fork |
| 2 | Referral rewards (counted after the invitee's first match, deduped per device, energy and cosmetics only) | ✅ Shipped |
| 3 | Public flagged-accounts list + admin flagging; flagged Chogs blocked from ranked and prize boards | ✅ Shipped |
| 4 | ChogBots metadata images (`/api/bots/image/<id>`) | ✅ Shipped |
| 5 | Move taps/bots/quests/pass reducers behind the API (server-authoritative Sparks) | ⏳ Next |
| 6 | Name filter for display and clan names (obfuscation-aware, Scunthorpe-safe, reserved names) | ✅ Shipped |
| 7 | Cloudflare Turnstile + edge rate limits | ⏳ Next |
| 8 | Contract audit / paid review | ⏳ Needs a vendor |
| 9 | Analytics: events, DAU, D1/D7 retention cohorts | ✅ Shipped (first-party, cookie-less). Error tracking (Sentry) still to add |
| 10 | Real-device QA, Lighthouse ≥ 85, 60 fps | ⏳ Manual pass on devices |
| 11 | Terms and Privacy pages | ✅ Shipped as templates (needs legal review) |
| 12 | Economy admin view | ✅ Shipped at `/admin` (sources vs sinks from cloud saves) |

## First weeks after launch

| # | Item | Status |
|---|---|---|
| 13 | Deck builder + card collection | ⏳ |
| 14 | Stakes mechanic (cube doubling / Conquest) | ⏳ |
| 15 | Turn timer + live PvP (Durable Objects) | ⏳ |
| 16 | More cards and lanes, balance pass | ⏳ |
| 17 | Missions on several cadences (8h / weekly / season) | ⏳ |
| 18 | Daily boosts (Full Tank, Turbo ×3) | ✅ Shipped |
| 19 | Upgrade cards (passive income layer) | ⏳ |
| 20 | Web push notifications | ⏳ |
| 21 | Live-ops event calendar | ⏳ |
| 22 | Clan chest claims | ✅ Shipped. Clan chat and clan wars still to come |
| 23 | Embedded wallet (email login) | ⏳ |
| 24 | Scripted first battle | ⏳ |

## Later

Telegram Mini App wrapper · onchain bots in the loop · replays and spectating · music · localisation · seasonal cosmetic gear drops.
