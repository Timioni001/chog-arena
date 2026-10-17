# Chog Genesis: collection research

Everything below was read directly from Monad mainnet and the collection's own IPFS metadata on 2026-10-17, then cross-checked against public listings. Nothing is hardcoded in the game: `npm run index:chogs` regenerates `src/data/collection.json` from the chain.

## Contracts

| | Value | How it was checked |
|---|---|---|
| Chain | Monad mainnet, chain id **143** (`eth_chainId` → `0x8f`) | `https://rpc.monad.xyz` |
| NFT contract | `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` | `name()` = "Chog Genesis", `symbol()` = "CHOG" |
| Standard | ERC-721 (`supportsInterface(0x80ac58cd)` = true), **not** ERC721Enumerable (`0x780e9d63` = false) | eth_call |
| Supply | **1,969** (`totalSupply()` = `0x7b1`), token ids **1–1969** (`tokenURI(0)` reverts) | eth_call |
| Royalty | ERC-2981: **5%** (`royaltyInfo(1, 10000)` → 500) to `0x84113421a8a564b594ee9ae78c875310332d7023` | eth_call |
| Holders | **983** distinct owners at block 114,250,783 (699 hold exactly one; largest wallet holds 73) | Multicall3 `ownerOf` over all ids |
| Metadata | `ipfs://bafybeid4ybujnscdipkno7ps5utqelp5ry5ryreqhay3zhgk3a6x4jruqu/<n>.json` | `tokenURI` |
| Images | `ipfs://bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e/<n>.webp` (never used by the game) | metadata |
| $CHOG token | `0x350035555E10d9AfAF1566AaebfCeD5BA6C27777`: `name()` "Chog", 18 decimals, `totalSupply()` 1,000,000,000 | eth_call; listed on chog.xyz and Monadscan |

Notes:

- The metadata is shuffled: token id N points at file M, and the display name uses M (token 1 is "CHOG #1462"). The game shows the display number and keys all progress by the token id.
- OpenSea lists the collection as **Chog Genesis** (opensea.io/collection/chog-genesis): 1,969 items, Monad, 5% creator fee. These match the chain.
- chog.xyz publishes the $CHOG address and links to x.com/ChogNFT and discord.com/invite/chog. It does not link the NFT contract directly, so the NFT address was confirmed via the contract's own `name`/`symbol`/`totalSupply`, the OpenSea listing and the mint site (mint.chog.xyz) as referenced in public repos.
- **Still open:** a field-by-field Magic Eden cross-check and a written confirmation from the official Chog channels. Both addresses are read from env config (`NEXT_PUBLIC_CHOG_NFT_ADDRESS`, `NEXT_PUBLIC_CHOG_TOKEN_ADDRESS`) so they can be swapped without code changes.
- Only one NFT contract was found (no separate pass or chest contract).

## Structure the game uses

- 13 trait types: Form, Base, Tier, Skin, Background, Aura, Head, Eyes, Mouth, Body, Accessory, Side, Naked.
- The collection's own **Tier** lines up exactly with **Base**: Common 1,279 + Uncommon 590 are Origin, Rare 60 are Skull, Epic 30 are Radioactive, Legendary 10 are the hand-made 1:1s. These become the four archetypes.
- The ten 1:1s only carry Base + Tier and have a name in their metadata (Blaze, Burning Skully, Chog Scream, Chogbomination, Frogger, Grim, Halo, Krown, Midas, Redd).
- "None" is counted as a value when a trait is missing, so every category sums to 1,969.

## Rarity

Statistical rarity: score = Σ −ln(count / 1969) over every trait type except Tier (Tier is the collection's own label and is shown separately). Rank 1 is the highest score. Scores and ranks are in `collection.json` and in the Chog Lab.

## Trait counts

### Form (3 values)

| Value | Count | Share |
|---|---:|---:|
| Chog | 1899 | 96.44% |
| Skull | 60 | 3.05% |
| None | 10 | 0.51% |

### Base (4 values)

| Value | Count | Share |
|---|---:|---:|
| Origin | 1869 | 94.92% |
| Skull | 60 | 3.05% |
| Radioactive | 30 | 1.52% |
| 1:1 | 10 | 0.51% |

### Tier (5 values)

| Value | Count | Share |
|---|---:|---:|
| Common | 1279 | 64.96% |
| Uncommon | 590 | 29.96% |
| Rare | 60 | 3.05% |
| Epic | 30 | 1.52% |
| Legendary | 10 | 0.51% |

### Skin (15 values)

| Value | Count | Share |
|---|---:|---:|
| Pink | 557 | 28.29% |
| Origin | 528 | 26.82% |
| Red | 299 | 15.19% |
| Black | 263 | 13.36% |
| Yellow | 246 | 12.49% |
| Blue | 13 | 0.66% |
| White | 11 | 0.56% |
| Green | 8 | 0.41% |
| Jade | 7 | 0.36% |
| Multi Colored | 7 | 0.36% |
| Purple | 7 | 0.36% |
| Beige | 6 | 0.30% |
| Metal | 4 | 0.20% |
| Grey | 3 | 0.15% |
| None | 10 | 0.51% |

### Background (33 values)

| Value | Count | Share |
|---|---:|---:|
| Light Purple | 183 | 9.29% |
| Lemon | 142 | 7.21% |
| Aqua | 133 | 6.75% |
| Mon | 131 | 6.65% |
| Sunlight | 130 | 6.60% |
| Lemon Yellow | 129 | 6.55% |
| Rosie | 127 | 6.45% |
| Coral Pink | 121 | 6.15% |
| Mint | 114 | 5.79% |
| Peach Pink | 95 | 4.82% |
| Light Magenta | 92 | 4.67% |
| Soft Lavender | 86 | 4.37% |
| Fresh Green | 85 | 4.32% |
| Sky Blue | 85 | 4.32% |
| Aqua Mint | 69 | 3.50% |
| Rosy Pink | 47 | 2.39% |
| Deep Aqua | 46 | 2.34% |
| Lime Green | 46 | 2.34% |
| Deep Blue | 45 | 2.29% |
| Radioactive | 30 | 1.52% |
| Deep Purple | 3 | 0.15% |
| Gold | 3 | 0.15% |
| Magenta | 3 | 0.15% |
| Red Sky | 3 | 0.15% |
| Bright Yellow | 2 | 0.10% |
| Royal Blue | 2 | 0.10% |
| Supreme Purple | 2 | 0.10% |
| Afternoon Orange | 1 | 0.05% |
| Aqua Blue | 1 | 0.05% |
| Blood Red | 1 | 0.05% |
| Noble Blue | 1 | 0.05% |
| Rose Pink | 1 | 0.05% |
| None | 10 | 0.51% |

### Aura (23 values)

| Value | Count | Share |
|---|---:|---:|
| Burning Aura | 82 | 4.16% |
| Fiery Aura | 72 | 3.66% |
| Aqua Aura | 67 | 3.40% |
| Rose Aura | 65 | 3.30% |
| Purple | 62 | 3.15% |
| Mint | 61 | 3.10% |
| Light Purple | 60 | 3.05% |
| Wind | 60 | 3.05% |
| Clean | 59 | 3.00% |
| Royal Blue Aura | 57 | 2.89% |
| Smoke | 57 | 2.89% |
| Cool Aura | 56 | 2.84% |
| Violet | 52 | 2.64% |
| Yellow Aura | 49 | 2.49% |
| Fire | 48 | 2.44% |
| Royal Aura | 45 | 2.29% |
| Green Aura | 8 | 0.41% |
| Rose Scent | 5 | 0.25% |
| Pink Mist | 3 | 0.15% |
| Royal Blue | 3 | 0.15% |
| Electric Shock | 2 | 0.10% |
| White Aura | 1 | 0.05% |
| None | 995 | 50.53% |

### Head (67 values)

| Value | Count | Share |
|---|---:|---:|
| Mon Cap | 70 | 3.56% |
| Russian Hat | 67 | 3.40% |
| Balls Cap | 62 | 3.15% |
| Horny Cap | 58 | 2.95% |
| Crown | 54 | 2.74% |
| Choggie Cap | 51 | 2.59% |
| Durag | 50 | 2.54% |
| Cloud Cap | 49 | 2.49% |
| TISM Cap | 49 | 2.49% |
| Blue Bucket Cap | 48 | 2.44% |
| Wizard Hat | 47 | 2.39% |
| Boob Cap | 46 | 2.34% |
| Bob Hair | 45 | 2.29% |
| Orange Bucket Cap | 45 | 2.29% |
| Dollar Cap | 44 | 2.23% |
| Thunder Cap | 41 | 2.08% |
| Spartan Helmet | 40 | 2.03% |
| Star Cap | 40 | 2.03% |
| Gray Bucket Cap | 38 | 1.93% |
| Peace hat | 38 | 1.93% |
| Red Peace Cap | 38 | 1.93% |
| BTC Cap | 37 | 1.88% |
| MCGA | 35 | 1.78% |
| MMGA Cap | 34 | 1.73% |
| Red Headband | 34 | 1.73% |
| Chog Cap | 33 | 1.68% |
| Buttcoin Cap | 31 | 1.57% |
| Clown Nose | 31 | 1.57% |
| Japan Headband | 31 | 1.57% |
| MEGA Chog | 31 | 1.57% |
| 10k TPS Cap | 30 | 1.52% |
| JEET Cap | 30 | 1.52% |
| Wizard Beanie | 30 | 1.52% |
| Choggie Beanie | 27 | 1.37% |
| RETARD Cap | 27 | 1.37% |
| BTC Beanie | 25 | 1.27% |
| Plumber | 25 | 1.27% |
| RH Beanie | 25 | 1.27% |
| WAGMI Cap | 25 | 1.27% |
| NEET | 24 | 1.22% |
| Robber | 24 | 1.22% |
| MCGA Cap | 21 | 1.07% |
| Mon Beanie | 21 | 1.07% |
| Rainbow Wig | 18 | 0.91% |
| Red Horn | 5 | 0.25% |
| 3rd Eye | 4 | 0.20% |
| Silver wreath | 4 | 0.20% |
| BOOB Cap | 3 | 0.15% |
| Demon Horn | 3 | 0.15% |
| Gold Thorn | 3 | 0.15% |
| Holy Seal | 3 | 0.15% |
| Diamond | 2 | 0.10% |
| ETH Cap | 2 | 0.10% |
| Purple Horn | 2 | 0.10% |
| Red Bandana | 2 | 0.10% |
| Silver Thorn | 2 | 0.10% |
| Taped Banana | 2 | 0.10% |
| Void Horn | 2 | 0.10% |
| 8 Ball Beanie | 1 | 0.05% |
| Blue Laser | 1 | 0.05% |
| devil horn | 1 | 0.05% |
| Head Wrap | 1 | 0.05% |
| Jeet Cap | 1 | 0.05% |
| Mafia Hat | 1 | 0.05% |
| Peace Cap | 1 | 0.05% |
| Poison Shroom | 1 | 0.05% |
| None | 253 | 12.85% |

### Eyes (59 values)

| Value | Count | Share |
|---|---:|---:|
| Happy | 121 | 6.15% |
| Side Eye | 101 | 5.13% |
| Purple laser | 96 | 4.88% |
| fire laser | 95 | 4.82% |
| Dead | 78 | 3.96% |
| Round | 77 | 3.91% |
| Normal Eye | 74 | 3.76% |
| Heart | 72 | 3.66% |
| Round Crying | 69 | 3.50% |
| Green laser | 68 | 3.45% |
| Round Tear | 65 | 3.30% |
| Anime Glass | 64 | 3.25% |
| Gradient visor | 61 | 3.10% |
| Round Eye | 61 | 3.10% |
| Closed Eye Crying | 57 | 2.89% |
| Retro Glass | 56 | 2.84% |
| Tired | 56 | 2.84% |
| Teary | 54 | 2.74% |
| Sunset visor | 53 | 2.69% |
| Plasma visor | 43 | 2.18% |
| Angry | 34 | 1.73% |
| Flat | 34 | 1.73% |
| Vertical | 34 | 1.73% |
| Base | 33 | 1.68% |
| MOG | 32 | 1.63% |
| Smirk | 32 | 1.63% |
| Frog | 29 | 1.47% |
| Clown Eye | 27 | 1.37% |
| Chog Viper | 26 | 1.32% |
| Modern VR | 26 | 1.32% |
| Classic VR | 25 | 1.27% |
| Clown Eye Mix | 25 | 1.27% |
| XD | 25 | 1.27% |
| Retard | 24 | 1.22% |
| 3D Glass | 22 | 1.12% |
| Worried | 22 | 1.12% |
| BTC Glass | 19 | 0.96% |
| cyan laser | 18 | 0.91% |
| Thug | 17 | 0.86% |
| Red Round Eye | 4 | 0.20% |
| Blue Retard | 3 | 0.15% |
| Green Side Eye | 3 | 0.15% |
| Blue Round Eye | 2 | 0.10% |
| Green Happy | 2 | 0.10% |
| Mixed Happy | 2 | 0.10% |
| Mixed Retard | 2 | 0.10% |
| Mixed Side Eye | 2 | 0.10% |
| Normal | 2 | 0.10% |
| Red Flat | 2 | 0.10% |
| Up | 2 | 0.10% |
| Blue Flat | 1 | 0.05% |
| Blue Happy | 1 | 0.05% |
| Blue Smirk | 1 | 0.05% |
| Green Retard | 1 | 0.05% |
| Green Round Eye | 1 | 0.05% |
| Green Smirk | 1 | 0.05% |
| Mixed Round Eye | 1 | 0.05% |
| Red Retard | 1 | 0.05% |
| None | 10 | 0.51% |

### Mouth (16 values)

| Value | Count | Share |
|---|---:|---:|
| normal smile | 195 | 9.90% |
| Drooling | 184 | 9.34% |
| Sad | 184 | 9.34% |
| Smile | 179 | 9.09% |
| Bubblegum | 168 | 8.53% |
| Rainbow Puke | 145 | 7.36% |
| Gold Tooth | 127 | 6.45% |
| Worried | 127 | 6.45% |
| wo | 120 | 6.09% |
| Lip Bite | 108 | 5.49% |
| BTC Coin | 61 | 3.10% |
| Clown Mouth | 57 | 2.89% |
| Flat | 54 | 2.74% |
| Mon coin | 48 | 2.44% |
| Grit | 47 | 2.39% |
| None | 165 | 8.38% |

### Body (97 values)

| Value | Count | Share |
|---|---:|---:|
| Tuxedo | 55 | 2.79% |
| Gangster suit | 41 | 2.08% |
| Kings Robe | 41 | 2.08% |
| Black Trackset | 40 | 2.03% |
| Farmer Shirt | 39 | 1.98% |
| Squid Game Guard | 37 | 1.88% |
| Black Vest | 36 | 1.83% |
| Inmate | 35 | 1.78% |
| Red Tuxedo | 34 | 1.73% |
| White tuxedo | 34 | 1.73% |
| Prisoner | 33 | 1.68% |
| Six Seven | 33 | 1.68% |
| Stripes | 33 | 1.68% |
| Black Shirt | 31 | 1.57% |
| Cream Tuxedo | 31 | 1.57% |
| Fire Shirt | 31 | 1.57% |
| Chug Life | 30 | 1.52% |
| Hawaiian Polo | 30 | 1.52% |
| Blue Chinese | 29 | 1.47% |
| Duck Float | 29 | 1.47% |
| Tank Top | 29 | 1.47% |
| White Pure Shirt | 28 | 1.42% |
| CWO | 27 | 1.37% |
| Yellow Yukata | 27 | 1.37% |
| Pink Tuxedo | 26 | 1.32% |
| Yellow Shirt | 26 | 1.32% |
| Banana suit | 25 | 1.27% |
| Red Chinese | 25 | 1.27% |
| Shark Suit | 25 | 1.27% |
| Aqua Tuxedo | 24 | 1.22% |
| Astro Suit | 24 | 1.22% |
| Jesus | 24 | 1.22% |
| Wizard | 24 | 1.22% |
| Dragon suit | 23 | 1.17% |
| Red shirt | 23 | 1.17% |
| Blue tuxedo | 22 | 1.12% |
| MILF Lover | 22 | 1.12% |
| Red Trackset | 21 | 1.07% |
| Cyan tuxedo | 18 | 0.91% |
| Orange Hoodie | 18 | 0.91% |
| Squid Game | 18 | 0.91% |
| Golden Armor | 17 | 0.86% |
| Mon Hoodie | 17 | 0.86% |
| Orange Sleeveless | 17 | 0.86% |
| Red Sleeveless | 17 | 0.86% |
| Yellow Hoodie | 17 | 0.86% |
| Brown Homeless Shirt | 16 | 0.81% |
| pink vest | 16 | 0.81% |
| toad blue suit | 16 | 0.81% |
| White Sleeveless | 16 | 0.81% |
| Yellow 143 Jersey | 16 | 0.81% |
| Blue 143 Jersey | 15 | 0.76% |
| dark jacket | 15 | 0.76% |
| Sci Fi | 15 | 0.76% |
| Electro Hoodie | 14 | 0.71% |
| Red jacket | 14 | 0.71% |
| Virgin | 14 | 0.71% |
| Blue jacket | 13 | 0.66% |
| blue tee | 13 | 0.66% |
| Grey Homeless Shirt | 13 | 0.66% |
| Grey Shirt | 13 | 0.66% |
| Purple Shirt | 13 | 0.66% |
| red tee | 13 | 0.66% |
| White Shirt | 13 | 0.66% |
| dark tee | 12 | 0.61% |
| Glitch Hoodie | 12 | 0.61% |
| Army Vest | 11 | 0.56% |
| Blue Sleeveless | 11 | 0.56% |
| white tee | 11 | 0.56% |
| White Yukata | 11 | 0.56% |
| Zero THOTS | 11 | 0.56% |
| Blue Homeless Shirt | 10 | 0.51% |
| dark vest | 10 | 0.51% |
| purple vest | 10 | 0.51% |
| Sky Hoodie | 10 | 0.51% |
| BBC | 9 | 0.46% |
| Guko | 9 | 0.46% |
| Pink Shirt | 9 | 0.46% |
| Red 143 Jersey | 9 | 0.46% |
| Toad green Suit | 9 | 0.46% |
| Toad pink suit | 9 | 0.46% |
| Peach Hoodie | 8 | 0.41% |
| Cyan Shirt | 6 | 0.30% |
| Wizard Cape | 5 | 0.25% |
| Gojo | 4 | 0.20% |
| Stripe Shirt | 4 | 0.20% |
| CEO Vest | 3 | 0.15% |
| Mummy | 3 | 0.15% |
| Stripe shirts | 3 | 0.15% |
| Boner | 2 | 0.10% |
| Jesus Robe | 2 | 0.10% |
| Blue Holed Jacket | 1 | 0.05% |
| Blue Mafia | 1 | 0.05% |
| Orange Holed Jacket | 1 | 0.05% |
| Purple Tank | 1 | 0.05% |
| White Tank | 1 | 0.05% |
| None | 207 | 10.51% |

### Accessory (10 values)

| Value | Count | Share |
|---|---:|---:|
| Fwog | 28 | 1.42% |
| Coin | 26 | 1.32% |
| SB | 26 | 1.32% |
| Cigar | 25 | 1.27% |
| Green Candle | 23 | 1.17% |
| Heart | 18 | 0.91% |
| Knife | 18 | 0.91% |
| Red Candle | 18 | 0.91% |
| PEPE | 13 | 0.66% |
| None | 1774 | 90.10% |

### Side (3 values)

| Value | Count | Share |
|---|---:|---:|
| Right | 1309 | 66.48% |
| Left | 650 | 33.01% |
| None | 10 | 0.51% |

### Naked (3 values)

| Value | Count | Share |
|---|---:|---:|
| No | 1905 | 96.75% |
| Yes | 54 | 2.74% |
| None | 10 | 0.51% |

### Top 10 by statistical rarity

| Rank | Token id | Name | Score |
|---:|---:|---|---:|
| 1 | 1729 | CHOG #1221 | 47.116 |
| 2 | 181 | CHOG #1642 | 45.518 |
| 3 | 896 | CHOG #388 | 45.155 |
| 4 | 561 | CHOG #53 — Blaze | 44.549 |
| 5 | 900 | CHOG #392 — Burning Skully | 44.549 |
| 6 | 942 | CHOG #434 — Chog Scream | 44.549 |
| 7 | 1002 | CHOG #494 — Chogbomination | 44.549 |
| 8 | 1481 | CHOG #973 — Frogger | 44.549 |
| 9 | 1514 | CHOG #1006 — Grim | 44.549 |
| 10 | 1667 | CHOG #1159 — Halo | 44.549 |
