# Economy

Two currencies with a hard wall between them.

**Sparks** (soft, offchain): everyday rewards and spending.

| Sources | Amount |
|---|---|
| Taps | 1 energy each; energy cap ~500–900 and regen ~1.5–2.7/s bound daily output |
| Bots | 40–340/h per bot at Lv1, ×1.26 per level; offline capped at 3h (+3h via skills) |
| Battles | win 400 / draw 200 / loss 120 (+ up to 300 streak bonus in ranked); practice pays 25% |
| Campaign first clears | 300–2,600 once per stage |
| Daily quests | 3 per day, 300–1,000 each |
| Check-in streak | 200 → 2,000 |
| Daily combo | up to 5,000, once per day |
| Season pass | fixed per tier |
| Scrap bot | 30% of list price × level |

| Sinks | Cost |
|---|---|
| Bot shop | 600 – 20,000 |
| Merges | 150 × 1.6^(level−1) per merge, up to Lv10 |
| Skill respec | 1,000 + 100 × level |

Every change is tagged in the save's `ledger` (per source/sink), which feeds `/api/economy` and future balancing dashboards. Merge costs rise exponentially while bot yield rises ×1.26, so the long-run sink outpaces the source.

**$CHOG** (onchain, `0x3500…7777`): never emitted by the game. Referrals pay energy and cosmetics only.

- In: `ChogShop.buy()`; every purchase splits **30% burn / 40% season prize vault / 30% treasury** (configurable, launch caps: 20,000 CHOG per wallet per day).
- Out: `ChogArenaSeasons.claim()` with a merkle proof against the season-end root. A root can only be committed if the vault already holds the pool, and unclaimed prizes can only roll into a later season. The owner has no withdraw function.
