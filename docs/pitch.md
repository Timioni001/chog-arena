# Chog Arena: pitch, demo script and copy

## One line
Your Chog is your fighter: tap, build bots and battle in ranked seasons, with every trait, win and bot bound to the NFT itself.

## What it does
A mobile-first 3D game on Monad. You tap your Chog to earn Sparks, equip and merge bots that earn while you're away, and fight quick 3-lane card battles where your Chog's traits become your cards. Ranked seasons, a five-zone campaign, quests, a daily combo, a season pass with wearable gear, clans and leaderboards (season, weekly, rookie, per tier, per trait) keep people coming back.

## What's new
- **The token is the save file.** Progress, bots, MMR and onchain season records are keyed by token id, so a Chog's history is part of what you buy.
- **Traits are gameplay.** Every one of the 1,969 Chogs produces a different fighter: archetype, element, five stats, set synergies and seven trait cards, scaled by how rare each trait value really is.
- **Verifiable matches.** The server replays every ranked match from its seed and moves, then signs an EIP-712 result anyone can post onchain against the token.
- **Opponents are other Chogs.** Ranked ghosts are real tokens from the collection, so you meet the whole collection as you climb.

## Why Chog matters
Without a Chog there is no fighter, no account and no ranked. Holders get ranked and prizes, 2–3 bot slots, +50–80% energy, the holder pass track (Cozy Hoodie and Space Explorer gear), holder-only zones and clan leadership. Total stat edge from holding more Chogs is capped at +15%, so it stays fair.

## $CHOG
Spent in the shop (split between burn, prize vault and treasury); paid out only from that vault through merkle claims at season end. No emissions, no referral payouts.

## 3-minute demo script
| Time | Show |
|---|---|
| 0:00–0:20 | Open on a phone. Tutorial cards (storyboard art). Land on Home: the plush 3D Chog on its island. |
| 0:20–0:45 | Tap: combo multiplier, crit, Overcharge. Energy bar and bot income. |
| 0:45–1:10 | Profile → connect → Chogs load from chain → sign in. Home now shows *your* Chog's traits in 3D. Chog Lab: real trait counts, rarity rank, stats, synergies, trait cards, gear try-on. |
| 1:10–1:30 | Bots: equip into holder slots, merge two Pip Drones. |
| 1:30–2:25 | Battle → Find ranked match. Play three turns: cards to lanes, reveal order, element edge, an emote. Finish: Victory, server-verified replay, MMR, season rank. Tap *Record result on Monad*. |
| 2:25–2:45 | Ranks: season board, trait board for your Head trait, clans. Quests: daily combo and the pass. |
| 2:45–3:00 | Preview any Chog by id. "Sell this Chog and all of this goes with it." |

## Testing instructions (short)
- No wallet: open the link, play Practice and Campaign.
- With a Chog: connect, sign in (gasless), Battle → Find ranked match.
- `npm test`, `cd contracts && forge test`.

## Built with
Next.js, React Three Fiber, wagmi/viem, Foundry, Upstash Redis, Monad.

## Pre-existing work
None. Libraries are listed in `package.json`; character art is the project owner's original design (see `ASSETS.md`).

## What's next
Deploy contracts behind a multisig, live WebSocket PvP, clan wars, a Telegram Mini App wrapper, more zones and onchain bots via ChogBots.
