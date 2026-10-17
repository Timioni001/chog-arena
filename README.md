# Chog Arena

**Your Chog is your fighter.** A 3D tap-and-battle game on Monad where a Chog Genesis NFT is the character, the save file and the ticket to ranked play.

- Tap your Chog for Sparks, build combos and Overcharge.
- Equip and merge bots that earn while you're away.
- Battle in fast 3-lane, 6-turn matches: win 2 of 3 lanes. Your Chog's real traits become seven of your twelve cards.
- Climb ranked seasons (Bronze → Mythic), five campaign zones, daily quests, a daily combo puzzle and a season pass.
- Progress lives on the **token id**: sell the Chog and its level, bots and record go with it.

## Why the Chog matters

Remove the NFT and you lose the fighter, the account and access. Traits set the archetype (Origin, Skull, Radioactive, 1:1), element, stats, synergies, 3D look and battle cards. Ranked play, prize boards, clans, extra bot slots, +50–80% energy and the holder pass check onchain ownership at the moment you play. Guests get a demo Chog so they can see why.

## Run it

```bash
npm install
cp .env.example .env.local     # optional: everything has safe defaults
npm run dev                    # http://localhost:3000
```

Production on Cloudflare Workers (OpenNext): `npm run deploy`. Every key, step by step from WSL: **[docs/DEPLOY.md](docs/DEPLOY.md)**. Local Workers preview: `npm run preview`.

## Test it

| What | Command |
|---|---|
| Game rules, replay, economy (22 tests, incl. every one of the 1,969 tokens building a valid deck) | `npm test` |
| Types | `npm run lint` |
| Contracts (28 tests incl. fuzzing) | `cd contracts && forge test` |
| Re-index the collection from chain | `npm run index:chogs` |

### Try it as a judge or player

1. Open the app on a phone. The tutorial shows the loop in four cards.
2. **No wallet:** tap the demo Chog, equip a bot, play Practice or Campaign. Ranked shows exactly why it needs a Chog.
3. **With a Chog:** Profile → Browser wallet (or WalletConnect) → your Chogs load from chain → *Sign in* (gasless SIWE) → Battle → *Find ranked match*. After the match: server-verified result, MMR change, season rank, and (if contracts are configured) *Record result on Monad*.
4. **Chog Lab → Preview any Chog:** type any token id (1–1969) to see its 3D fighter, real trait counts, stats and cards.

### End-to-end on a mainnet fork

Verified with Playwright against an `anvil --fork-url https://rpc.monad.xyz --chain-id 143` fork: a real Chog was moved to a test wallet, contracts were deployed with `script/Deploy.s.sol`, and the browser flow (connect → SIWE → ranked match → server replay → EIP-712 attestation → `recordMatch`) incremented the token's onchain season record.

## Addresses

| | Monad mainnet |
|---|---|
| Chog Genesis (ERC-721, 1,969) | [`0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763`](https://monadvision.com/address/0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763) |
| $CHOG (ERC-20) | [`0x350035555E10d9AfAF1566AaebfCeD5BA6C27777`](https://monadvision.com/token/0x350035555E10d9AfAF1566AaebfCeD5BA6C27777) |
| ChogArenaSeasons / ChogShop / ChogBots | **Not deployed yet.** Needs the owner multisig, a funded deployer and an attestor key. See `contracts/README.md`. |

Research and verification notes: [`docs/collection-research.md`](docs/collection-research.md).

## Stack

Next.js 15 (App Router) on Cloudflare Workers via OpenNext · TypeScript · React Three Fiber + drei · Zustand · Tailwind 4 · Framer Motion · wagmi + viem (SIWE, Multicall3) · Upstash Redis (optional) · Foundry · Vitest · PWA.

More: [architecture](docs/architecture.md) · [economy](docs/economy.md) · [pitch & demo script](docs/pitch.md) · [assets](ASSETS.md).

## Honest status

- Contracts are **unaudited**. They ship pausable, Ownable2Step (multisig owner), with per-wallet and per-day caps, and no function that lets the owner withdraw prize funds.
- Without `UPSTASH_REDIS_*` the server uses memory: boards reset on restart.
- Taps, bots, quests and pass progress are computed client-side and synced per token with sanity checks; ranked results are fully server-authoritative.
- Live real-time PvP (WebSockets) and the Telegram Mini App wrapper are not built yet. Ranked uses async "ghost" opponents: real Chogs from the collection piloted by the arena AI.
- WalletConnect needs `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`; browser and in-app wallets work without it.
