# Deploy guide: every key, from WSL, to Cloudflare

Written for WSL (Ubuntu) with Node 22 LTS or newer (Node 26 works too). Run every command inside the WSL shell from your Linux home directory (for example `~/code`), not under `/mnt/c`: builds are several times faster there.

You will end up with three kinds of values:

| Kind | Where it lives | Examples |
|---|---|---|
| **Build-time public** (`NEXT_PUBLIC_*`) | `.env.production.local` on the machine that builds | contract addresses, WalletConnect id, site URL |
| **Runtime secrets** | Cloudflare Worker secrets (`wrangler secret put`) | `SESSION_SECRET`, `ATTESTOR_PRIVATE_KEY`, Upstash token |
| **Contract deploy keys** | Foundry encrypted keystore + a Safe | deployer key, owner multisig, treasury |

Never paste a private key into a `NEXT_PUBLIC_*` variable, chat, or git.

---

## 0. One-time WSL setup

```bash
sudo apt update && sudo apt install -y git curl openssl build-essential jq

# Node (skip if `node -v` already shows v22+)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22 && nvm use 22

# Foundry (forge, cast, anvil)
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup

# Project
git clone --recurse-submodules https://github.com/Timioni001/chog-arena.git
cd chog-arena
npm ci
(cd contracts && forge build && forge test)
npm test
```

---

## 1. `SESSION_SECRET` (required)

Signs sign-in cookies and challenge links.

```bash
openssl rand -hex 32
```

Copy the 64-character output. You'll store it as a Cloudflare secret in step 9.

## 1b. `ADMIN_TOKEN` (required for ops)

Unlocks `/admin` (retention, events, Spark economy, flags), flagging Chogs, and publishing season prize proofs.

```bash
openssl rand -hex 24
```

Keep it in a password manager. It's a Worker secret (step 9), never a `NEXT_PUBLIC_*` value.

## 2. `ATTESTOR_PRIVATE_KEY` + `ATTESTOR_ADDRESS` (needed for onchain match records)

A dedicated hot key the server uses to sign match results. It never holds funds.

```bash
cast wallet new
```

Save both lines it prints:
- `Address` → `ATTESTOR_ADDRESS` (goes into the contract deploy, step 7)
- `Private key` → `ATTESTOR_PRIVATE_KEY` (Cloudflare secret, step 9)

## 3. Deployer wallet (deploys the contracts once)

Create a fresh key and keep it in Foundry's encrypted keystore, never in a file:

```bash
cast wallet new                                   # note the Address and Private key
cast wallet import chog-deployer --interactive    # paste the private key, choose a password
cast wallet list                                  # shows chog-deployer
export DEPLOYER=0xYourDeployerAddress
```

Send it **mainnet MON** (Monad's native gas token on chain 143, the real one you buy on an exchange or bridge; testnet MON from the faucet is a different, worthless token and only works for the step 7 dry run).

How much: a simulation of `Deploy.s.sol` against mainnet (7 transactions: 3 contract deploys, `setMinter`, 3 ownership transfers) used ~8.0M gas, which forge priced at **~1.6 MON** with its padded gas price (202 gwei; the live price was ~102 gwei). Monad charges by gas *limit*, not gas used, so send **3 MON** to the deployer and keep ~0.5 MON in the Safe signer wallet that will execute `acceptOwnership`, `createSeason` and `setItem`. Re-run the estimate yourself just before deploying (step 7, run the forge command without `--broadcast`; the "ETH" in its output means MON). Leftover MON can be sent back afterwards.

Check the balance:

```bash
cast balance $DEPLOYER --rpc-url https://rpc.monad.xyz --ether
```

## 4. `OWNER_MULTISIG` and `TREASURY_ADDRESS`

The contracts end up owned by a multisig, not by the deployer.

1. Open <https://app.safe.global>, connect a signer wallet, pick **Monad** as the network. The Monad docs list Safe as supported on mainnet: <https://docs.monad.xyz/tooling-and-infra/wallets/multisig-wallets>.
2. Create a Safe with 2-of-3 (or stricter) signers you control. Copy the Safe address → `OWNER_MULTISIG`.
3. `TREASURY_ADDRESS`: the same Safe, or a second Safe for treasury funds.

If Monad isn't selectable in the Safe UI on the day you deploy, stop and use a hardware-wallet address as a temporary owner. Transfer to a Safe later with `transferOwnership` + `acceptOwnership`.

## 5. RPC URLs

The public RPC (`https://rpc.monad.xyz`) works but is rate-limited. For production:

1. Create a Monad Mainnet app at a provider (Alchemy, QuickNode, Chainstack and others support Monad). Copy the HTTPS URL that contains your key.
2. Use it **only** server-side as `MONAD_RPC_URL` (a Worker secret), because anything in `NEXT_PUBLIC_*` ships to browsers.
3. Keep `NEXT_PUBLIC_MONAD_RPC_URL=https://rpc.monad.xyz`, or use a second key restricted to your domain in the provider's allowlist.

## 6. Upstash Redis (required on Cloudflare)

Cloudflare runs the app on many short-lived isolates that don't share memory. Leaderboards, MMR, clans and cloud saves need a shared store.

1. Sign up at <https://console.upstash.com> → **Create database** → type Redis, region closest to your players, free plan is fine to start.
2. Open the database → **REST API** section. Copy:
   - `UPSTASH_REDIS_REST_URL` (looks like `https://xxxx.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN`

## 7. Deploy the contracts (Monad testnet first, then mainnet)

```bash
cd contracts
export CHOG_TOKEN_ADDRESS=0x350035555E10d9AfAF1566AaebfCeD5BA6C27777
export CHOG_NFT_ADDRESS=0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763
export OWNER_MULTISIG=0xYourSafe
export TREASURY_ADDRESS=0xYourTreasury
export ATTESTOR_ADDRESS=0xFromStep2
export BOTS_URI="https://YOUR_DOMAIN/api/bots/{id}.json"
```

**Dry run on testnet (chain 10143).** Get test MON from the faucet linked in the Monad docs. Testnet has no Chog NFT or $CHOG, so deploy against placeholder addresses only to rehearse the flow:

```bash
export MONAD_TESTNET_RPC_URL=https://testnet-rpc.monad.xyz
forge script script/Deploy.s.sol --rpc-url $MONAD_TESTNET_RPC_URL --account chog-deployer --sender $DEPLOYER --broadcast
```

**Mainnet (chain 143):**

```bash
export MONAD_RPC_URL=https://rpc.monad.xyz        # or your keyed URL from step 5
forge script script/Deploy.s.sol --rpc-url $MONAD_RPC_URL --account chog-deployer --sender $DEPLOYER --broadcast
```

The script prints three addresses. Save them:

```
ChogArenaSeasons 0x...   -> NEXT_PUBLIC_SEASONS_ADDRESS
ChogBots         0x...
ChogShop         0x...   -> NEXT_PUBLIC_SHOP_ADDRESS
```

**Verify source on MonadVision** (Sourcify), per the Monad docs (<https://docs.monad.xyz/guides/verify-smart-contract/foundry>):

```bash
forge verify-contract <SEASONS> src/ChogArenaSeasons.sol:ChogArenaSeasons --chain 143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org
forge verify-contract <BOTS>    src/ChogBots.sol:ChogBots                 --chain 143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org
forge verify-contract <SHOP>    src/ChogShop.sol:ChogShop                 --chain 143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org
```

**Finish setup from the Safe** (Safe → New transaction → Transaction Builder, paste each contract address and the ABI from `contracts/out/<Name>.sol/<Name>.json`):

1. `acceptOwnership()` on **each** of the three contracts. Until this is done the deployer still owns them.
2. On `ChogArenaSeasons`: `createSeason(start, end, claimDeadline)` with unix timestamps. Generate them in WSL:
   ```bash
   date -u -d '2026-11-03 00:00' +%s   # start
   date -u -d '2026-12-01 00:00' +%s   # end
   date -u -d '2026-12-31 00:00' +%s   # claim deadline (must be after end)
   ```
   The app's season numbering expects this first season to be id 1 (`SEASON` in `src/game/season.ts`; update its dates to match).
3. On `ChogShop`: `setItem(itemId, priceWei, supply, maxPerWallet, active, botId)` for items 1–3 shown in the app. Price is in $CHOG wei: `cast to-wei 250` gives 250 CHOG.

Check ownership landed:

```bash
cast call <SEASONS> "owner()(address)" --rpc-url $MONAD_RPC_URL     # must print your Safe
cast call <SEASONS> "attestor()(address)" --rpc-url $MONAD_RPC_URL  # must print ATTESTOR_ADDRESS
```

## 7b. Premium pass and MON prize pool (`ChogPass`)

`ChogPass` sells the Premium season pass in MON and holds the season's MON prize pool. By default 50% of every pass goes to the pool and 50% to your treasury, and anyone can add MON to the pool with **Sponsor the pool**. It deploys on its own, so the contracts from step 7 don't change.

```bash
cd contracts
export OWNER_MULTISIG=0xYourSafe TREASURY_ADDRESS=0xYourTreasury
export PASS_PRICE_WEI=$(cast to-wei 5)                  # 5 MON per pass
export PASS_END=$(date -u -d '2026-11-03 00:00' +%s)    # same end as SEASON.end in src/game/season.ts
export PASS_CLAIM_DEADLINE=$(date -u -d '2026-12-03 00:00' +%s)
forge script script/DeployPass.s.sol --rpc-url $MONAD_RPC_URL --account chog-deployer --sender $DEPLOYER --broadcast
forge verify-contract <PASS> src/ChogPass.sol:ChogPass --chain 143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org
```

Then in the Safe: `acceptOwnership()` on `ChogPass`. Set `NEXT_PUBLIC_PASS_ADDRESS=<PASS>` (step 9). Optional: change the pool share with `setPrizeBps` (max 9000 = 90%) or the price with `setSeason`.

- The treasury share accrues in the contract; anyone can call `withdrawTreasury()` and it only ever pays `TREASURY_ADDRESS`.
- Chog holders get the Premium track free; the pass is for everyone else (and holders who want to back the pool can sponsor).
- Premium only unlocks cosmetics and Sparks. It never changes ranked strength.

## 8. WalletConnect project id (optional, recommended for mobile)

1. <https://cloud.reown.com> → sign in → **Create project** (type: AppKit / WalletKit is not needed).
2. Copy the **Project ID** → `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
3. In the project's **Domain** allowlist, add your production domain (and `localhost` for testing).

Without it, browser-extension wallets and wallet in-app browsers still work.

## 9. Cloudflare

```bash
cd ~/code/chog-arena
npx wrangler login        # if the browser doesn't open from WSL, copy the printed URL into Windows
```

**Build-time values.** Create `.env.production.local` (git-ignored) in the project root:

```bash
cat > .env.production.local <<'ENV'
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_MONAD_RPC_URL=https://rpc.monad.xyz
NEXT_PUBLIC_CHOG_NFT_ADDRESS=0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763
NEXT_PUBLIC_CHOG_TOKEN_ADDRESS=0x350035555E10d9AfAF1566AaebfCeD5BA6C27777
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_reown_project_id
NEXT_PUBLIC_SEASONS_ADDRESS=0x...from_step_7
NEXT_PUBLIC_SHOP_ADDRESS=0x...from_step_7
NEXT_PUBLIC_PASS_ADDRESS=0x...from_step_7b
ENV
```

Leave the contract lines empty until steps 7 and 7b are done. The app hides the shop and "Record result on Monad" while they're empty, and the prize pool shows "Opens with the season".

**Building on the Cloudflare dashboard instead of WSL?** `NEXT_PUBLIC_*` values are baked in at build time, so add them under Workers → chog-arena → Settings → Build → **Variables and secrets** (build variables, not runtime ones), then redeploy.

**First deploy** (creates the Worker named `chog-arena`):

```bash
npm run deploy
```

**Runtime secrets.** Each command prompts for the value; paste and press Enter:

```bash
npx wrangler secret put SESSION_SECRET            # step 1
npx wrangler secret put ADMIN_TOKEN               # step 1b
npx wrangler secret put UPSTASH_REDIS_REST_URL    # step 6
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN  # step 6
npx wrangler secret put ATTESTOR_PRIVATE_KEY      # step 2 (only once contracts are deployed)
npx wrangler secret put MONAD_RPC_URL             # step 5 keyed URL (optional; overrides the default in wrangler.jsonc)
npx wrangler secret list
```

Secrets apply immediately; no redeploy needed. Changing any `NEXT_PUBLIC_*` value **does** need `npm run deploy` again, because those values are compiled into the client.

**Custom domain:** Cloudflare dashboard → Workers & Pages → `chog-arena` → Settings → Domains & Routes → Add → Custom domain. Then:
- set `NEXT_PUBLIC_SITE_URL` to it and run `npm run deploy` again;
- add it to the Reown allowlist (step 8) and your RPC provider's allowlist (step 5).

Sign-in checks that the signed message's domain matches the host serving the app, so always test sign-in on the final domain.

**Git-connected builds (alternative to `npm run deploy` from WSL):** Workers & Pages → `chog-arena` → Settings → Build → connect the GitHub repo. Then set:
- Build command `npx opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion` (OpenNext refuses Next.js 15 now that it is past its support window, until the app moves to Next.js 16)
- Deploy command `npx opennextjs-cloudflare deploy`
- Build variables: every `NEXT_PUBLIC_*` value above
- Keep secrets as Worker secrets (the step 9 list), not build variables.

## 10. Check it

```bash
curl -s https://YOUR_DOMAIN/api/health | jq
```

You want `"ok": true`, `"store": "upstash"`, `"warnings": []`, and `"attestations": true` once contracts and the attestor are set.

Then on a phone: open the site → Profile → connect → **Sign in** → Battle → **Find ranked match** → finish → **Record result on Monad** → confirm it with:

```bash
cast call <SEASONS> "matches(uint256,uint256)(uint32)" 1 <YOUR_TOKEN_ID> --rpc-url https://rpc.monad.xyz
```

## 11. Running a season (ops)

**During the season**
- Dashboard: `https://YOUR_DOMAIN/admin` → paste `ADMIN_TOKEN`. Shows daily actives, new players, D1/D7 retention, key events and Spark sources vs sinks.
- Flag a cheater (shown publicly on Ranks with the reason; blocks ranked and prize boards):
  ```bash
  curl -X POST https://YOUR_DOMAIN/api/admin/flags -H "authorization: Bearer $ADMIN_TOKEN" \
    -H 'content-type: application/json' -d '{"tokenId":123,"reason":"Automated play","days":14}'
  ```
  Clear with the same body and `-X DELETE`, or use the form on `/admin`.

**After the season ends** (`SEASON.end` in `src/game/season.ts` and the onchain `end` have passed):
1. Make sure the prize pool sits in `ChogArenaSeasons` (shop prize share plus anything you transfer in).
2. Build the tree from the final board and publish the proofs to the app:
   ```bash
   export ADMIN_TOKEN=...            # same as the Worker secret
   export MONAD_RPC_URL=https://rpc.monad.xyz
   npm run prizes:build -- --site https://YOUR_DOMAIN --season 1 --pool 100000 --cap 5000 --publish
   ```
   `--pool` is in whole $CHOG and must not exceed what's in the vault; `--cap` must match the contract's `maxClaimPerWallet`. Payouts go to whoever owns each ranked Chog at the snapshot: 15% / 10% / 7% for the top 3, 3% each for 4–10, 1% each for 11–50, 0.14% each for 51–100. Anything over a wallet's cap stays in the vault. The script writes `out/prizes-season-1.json`; keep it as the audit record.
3. In the Safe, call the line it prints: `ChogArenaSeasons.setPrizeRoot(1, <root>, <total>)`.
4. Players see **Claim prize** on the Ranks screen and claim from their own wallet until the claim deadline. After the deadline, the Safe can call `rollover(1)` to release unclaimed funds for the next season.
5. MON pool (from `ChogPass`): read the pool with `cast call <PASS> "poolOf(uint256)(uint256)" 1 --rpc-url $MONAD_RPC_URL`, then
   ```bash
   npm run prizes:build -- --site https://YOUR_DOMAIN --season 1 --asset mon --pool <MON, whole units> --publish
   ```
   and in the Safe call the printed `ChogPass.setPrizeRoot(1, <root>)`. Players claim MON from the same Ranks card. After the claim deadline, `rollover(1, 2)` moves anything unclaimed into season 2's pool.
6. Before the next season: `setSeason(2, price, end, claimDeadline)` on `ChogPass` and `createSeason` on `ChogArenaSeasons`, and bump `SEASON` in `src/game/season.ts`.

Verified on a Monad mainnet fork: ranked match → board → `prizes:build --publish` → `setPrizeRoot` → `claim` with the app's proof paid 1,500 CHOG, and a second claim reverted.

## Local preview in the Workers runtime

```bash
echo 'SESSION_SECRET=dev-only-secret' > .dev.vars
npm run preview           # builds with OpenNext and serves on http://localhost:8787
```

## Key checklist

| Key | Step | Stored as |
|---|---|---|
| `SESSION_SECRET` | 1 | Worker secret |
| `ADMIN_TOKEN` | 1b | Worker secret + your shell when running `prizes:build` |
| `ATTESTOR_PRIVATE_KEY` | 2 | Worker secret |
| `ATTESTOR_ADDRESS` | 2 | deploy env (contract constructor) |
| deployer key | 3 | Foundry keystore `chog-deployer` |
| `OWNER_MULTISIG`, `TREASURY_ADDRESS` | 4 | deploy env |
| `MONAD_RPC_URL` | 5 | Worker secret (or var in `wrangler.jsonc`) |
| `NEXT_PUBLIC_MONAD_RPC_URL` | 5 | `.env.production.local` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | 6 | Worker secrets |
| `NEXT_PUBLIC_SEASONS_ADDRESS`, `NEXT_PUBLIC_SHOP_ADDRESS` | 7 | `.env.production.local` |
| `NEXT_PUBLIC_PASS_ADDRESS` | 7b | `.env.production.local` (or Cloudflare build variables) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | 8 | `.env.production.local` |
| `NEXT_PUBLIC_SITE_URL` | 9 | `.env.production.local` |
| `NEXT_PUBLIC_CHOG_NFT_ADDRESS`, `NEXT_PUBLIC_CHOG_TOKEN_ADDRESS` | prefilled | `.env.production.local` |
