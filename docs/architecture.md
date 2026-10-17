# Architecture

```
src/
  game/         Pure TypeScript rules. Runs in the browser and on the server, so every ranked
                match can be replayed and verified. 22 unit tests in game/__tests__.
    collection.ts   indexed Chog Genesis data (traits, counts, ranks)
    chog.ts         traits → archetype, element, stats, synergies, 7 trait cards, 12-card deck
    config/trait-rules.json   the trait → gameplay mapping (keyword rules, never per-token data)
    battle.ts       3 lanes × 6 turns, simultaneous reveal, abilities, element edges, scoring
    ai.ts           deterministic opponent (rookie / adept / master), seeded per turn
    match.ts        replayMatch(), ghost opponents (real Chogs piloted by the AI), opponent builder
    progress.ts     every reducer that changes a save: taps, bots, merges, quests, pass, matches
    bots.ts tap.ts progression.ts daily.ts season.ts mmr.ts campaign.ts stage.ts rng.ts
  server/       Next.js route-handler services
    chain.ts        viem client; ownerOf; holdings via Multicall3 (collection is not enumerable)
    session.ts      SIWE nonce + HMAC-sealed session cookies
    arena.ts        match start/finish, server replay, MMR, transfer lock, leaderboards
    attest.ts       EIP-712 MatchResult signatures for ChogArenaSeasons.recordMatch
    clans.ts kv.ts  clans; Upstash Redis or in-memory store
  app/api/…     thin HTTP wrappers over server/*
  components/   React UI, React Three Fiber scene, screens, match view
  lib/          wagmi config, zustand store, hooks, appearance mapping, art, sound
contracts/      Foundry: ChogArenaSeasons, ChogShop, ChogBots + tests + deploy script
scripts/index-collection.mjs   rebuilds src/data/collection.json from chain + IPFS
```

## Why the NFT is the game

- **Identity:** the token's traits build the fighter: archetype (Origin, Skull, Radioactive, 1:1), element (from Aura, Background or Skin), five stats, set synergies and **seven of the twelve battle cards**. Rarer trait values make stronger cards.
- **Account:** progress is keyed by token id (`progress:<id>`, `player:<id>`). Sell the Chog and the buyer inherits its level, bots, MMR and history; the seller loses them.
- **Access:** ranked play, prize boards, clans (create/lead), 2–3 bot slots, +50–80% energy and the holder pass track need a Chog the wallet owns *right now* (checked onchain at match start and finish).

## Ranked match flow

1. `POST /api/match/start` with the active token. The server checks the SIWE session and `ownerOf`, rolls a seed, picks a ghost opponent (a random real Chog piloted by the AI at the player's MMR) and stores the pending match.
2. The client builds the identical battle from the seed with the same code and plays it.
3. `POST /api/match/finish` sends only the player's plays per turn. The server rebuilds both decks from token data, replays the whole match (opponent moves are recomputed), rejects any illegal play, re-checks ownership, updates MMR and boards, and returns an EIP-712 attestation.
4. Optionally the player submits the attestation to `ChogArenaSeasons.recordMatch`, which verifies the signer, the nonce (`matchId`), the season window and `ownerOf`, then increments wins/points for the **token id** onchain.

## Integrity

- Server-authoritative scoring: clients never submit scores, only moves.
- Tap rate capped at 15/s client-side; `plausibleTaps()` for server checks. Offline income capped (3h + skills).
- 24h ranked-reward lock after the server sees a token change hands (MMR still updates; prize boards and attestations wait).
- Holdings bonus capped so tier + extra Chogs never exceed +15% stats.
- Rate limit: 60 matches per wallet per hour.

## What is client-side today

Taps, bots, quests and the pass are reduced client-side and synced to `/api/progress/<id>` (server rejects saves that fail sanity checks, and newer server copies win). Ranked MMR and leaderboards are server-only. Moving the remaining reducers behind the API is mechanical because they are already pure functions in `game/progress.ts`.
