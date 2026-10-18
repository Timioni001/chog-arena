# Contracts

| Contract | Purpose |
|---|---|
| `ChogArenaSeasons` | Seasons, weekly ranking roots, EIP-712 attested match records per **token id**, merkle prize claims in $CHOG from a pre-funded vault. No owner withdrawal; unclaimed prizes only roll over. |
| `ChogShop` | Spend $CHOG on items. Splits each purchase into burn / prize vault / treasury in the same tx (holds no balance). Per-wallet daily cap, slippage guard, supply and per-wallet limits. |
| `ChogBots` | ERC-1155 bots and cosmetics; minted by the shop; ids can be soulbound. |

All are `Ownable2Step` + `Pausable`. **Unaudited.**

```bash
forge test                        # 28 tests, fuzzing included
forge fmt --check

# testnet dry run (chain 10143), then mainnet (143)
export OWNER_MULTISIG=0x... CHOG_TOKEN_ADDRESS=0x350035555E10d9AfAF1566AaebfCeD5BA6C27777 \
       CHOG_NFT_ADDRESS=0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763 ATTESTOR_ADDRESS=0x... TREASURY_ADDRESS=0x...
forge script script/Deploy.s.sol --rpc-url monad --broadcast --verify   # MONAD_RPC_URL in env
```

After deploy: the multisig calls `acceptOwnership()` on all three, then `createSeason(...)` on Seasons and `setItem(...)` on the shop. Put the addresses in `NEXT_PUBLIC_SEASONS_ADDRESS` / `NEXT_PUBLIC_SHOP_ADDRESS` and the attestor key in `ATTESTOR_PRIVATE_KEY`.

Launch caps in `Deploy.s.sol`: 5,000 CHOG max claim per wallet, 100,000 CHOG claimed per day, 20,000 CHOG shop spend per wallet per day, split 30% burn / 40% prizes / 30% treasury.
