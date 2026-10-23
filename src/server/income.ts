import 'server-only';
import { decodeEventLog, formatEther, getAddress, parseAbi, type Address } from 'viem';
import { publicClient } from './chain';
import { kv } from './kv';
import { dayKey } from '@/game/daily';
import { SEASON } from '@/game/season';

// Same build-time addresses the client uses (read directly so the server never loads wagmi).
const CHOG_TOKEN = (process.env.NEXT_PUBLIC_CHOG_TOKEN_ADDRESS || '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777') as Address;
const PASS_ADDRESS = process.env.NEXT_PUBLIC_PASS_ADDRESS || '';
const SHOP_ADDRESS = process.env.NEXT_PUBLIC_SHOP_ADDRESS || '';
const SEASONS_ADDRESS = process.env.NEXT_PUBLIC_SEASONS_ADDRESS || '';

/**
 * Revenue read straight from the contracts, so it is right even for purchases made outside the
 * app. Each read also stores a per-day snapshot; the daily chart is the difference between them.
 */
const passAbi = parseAbi([
  'function seasons(uint256) view returns (uint128 price, uint64 end, uint64 claimDeadline, uint128 pool, uint128 claimed, bytes32 root, uint32 sold)',
  'function treasuryOwed() view returns (uint256)',
  'function prizeBps() view returns (uint16)',
  'function treasury() view returns (address)',
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'event PassBought(uint256 indexed seasonId, address indexed buyer, address indexed holder, uint256 price, uint256 toPool)',
  'event Sponsored(uint256 indexed seasonId, address indexed from, uint256 amount, string note)',
]);
const shopAbi = parseAbi([
  'function items(uint256) view returns (uint128 price, uint32 supply, uint32 sold, uint32 maxPerWallet, bool active, uint256 botId)',
  'function burnBps() view returns (uint16)',
  'function prizeBps() view returns (uint16)',
  'function treasury() view returns (address)',
  'function prizeVault() view returns (address)',
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'event Purchased(address indexed buyer, uint256 indexed itemId, uint32 quantity, uint256 total, uint256 burned, uint256 toPrize)',
]);
const seasonsAbi = parseAbi([
  'function totalCommitted() view returns (uint256)',
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function seasons(uint256) view returns (uint64 start, uint64 end, uint64 claimDeadline, bytes32 prizeRoot, uint128 prizePool, uint128 claimed)',
]);
const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)']);

export const SHOP_ITEMS = [
  { id: 1, name: 'Arena Frame: Neon' },
  { id: 2, name: 'Zap Kite (onchain)' },
  { id: 3, name: 'Season Entry Pass' },
];

const SID = BigInt(SEASON.id);
const n = (wei: bigint | undefined) => (wei === undefined ? 0 : Number(formatEther(wei)));

export interface Income {
  at: number;
  block: number;
  pass: null | {
    address: Address; owner: Address | null; paused: boolean; treasury: Address | null; prizeBps: number;
    price: number; sold: number; gross: number; toPool: number; toTreasury: number;
    pool: number; sponsorsAndRollovers: number; claimed: number; treasuryOwed: number; balance: number;
    end: number; claimDeadline: number; rootSet: boolean;
  };
  shop: null | {
    address: Address; owner: Address | null; paused: boolean; treasury: Address | null; prizeVault: Address | null; burnBps: number; prizeBps: number;
    items: { id: number; name: string; price: number; sold: number; supply: number; active: boolean; gross: number }[];
    gross: number; burned: number; toPrize: number; toTreasury: number;
  };
  vault: null | { address: Address; owner: Address | null; paused: boolean; balance: number; committed: number; free: number; pool: number; claimed: number; rootSet: boolean };
  treasuries: { address: Address; mon: number; chog: number }[];
}

/** Every number is in whole tokens (MON or $CHOG) as a float, which is plenty for a dashboard. */
export async function readIncome(): Promise<Income> {
  const pass = PASS_ADDRESS ? getAddress(PASS_ADDRESS) : null;
  const shop = SHOP_ADDRESS ? getAddress(SHOP_ADDRESS) : null;
  const vault = SEASONS_ADDRESS ? getAddress(SEASONS_ADDRESS) : null;
  const calls = [
    ...(pass ? [
      { address: pass, abi: passAbi, functionName: 'seasons', args: [SID] },
      { address: pass, abi: passAbi, functionName: 'treasuryOwed' },
      { address: pass, abi: passAbi, functionName: 'prizeBps' },
      { address: pass, abi: passAbi, functionName: 'treasury' },
      { address: pass, abi: passAbi, functionName: 'owner' },
      { address: pass, abi: passAbi, functionName: 'paused' },
    ] : []),
    ...(shop ? [
      { address: shop, abi: shopAbi, functionName: 'burnBps' },
      { address: shop, abi: shopAbi, functionName: 'prizeBps' },
      { address: shop, abi: shopAbi, functionName: 'treasury' },
      { address: shop, abi: shopAbi, functionName: 'prizeVault' },
      { address: shop, abi: shopAbi, functionName: 'owner' },
      { address: shop, abi: shopAbi, functionName: 'paused' },
      ...SHOP_ITEMS.map((it) => ({ address: shop, abi: shopAbi, functionName: 'items', args: [BigInt(it.id)] })),
    ] : []),
    ...(vault ? [
      { address: CHOG_TOKEN, abi: erc20, functionName: 'balanceOf', args: [vault] },
      { address: vault, abi: seasonsAbi, functionName: 'totalCommitted' },
      { address: vault, abi: seasonsAbi, functionName: 'owner' },
      { address: vault, abi: seasonsAbi, functionName: 'paused' },
      { address: vault, abi: seasonsAbi, functionName: 'seasons', args: [SID] },
    ] : []),
  ];
  const [block, res] = await Promise.all([
    publicClient.getBlockNumber(),
    calls.length ? publicClient.multicall({ contracts: calls as never, allowFailure: true }) : Promise.resolve([]),
  ]);
  let i = 0;
  const next = <T>() => { const r = res[i++] as { status: string; result?: unknown } | undefined; return (r?.status === 'success' ? r.result : undefined) as T | undefined; };
  const out: Income = { at: Date.now(), block: Number(block), pass: null, shop: null, vault: null, treasuries: [] };

  if (pass) {
    const s = next<readonly [bigint, bigint, bigint, bigint, bigint, `0x${string}`, number]>();
    const owed = next<bigint>(), bps = next<number>() ?? 5000, treasury = next<Address>() ?? null, owner = next<Address>() ?? null, paused = next<boolean>() ?? false;
    const price = n(s?.[0]), sold = Number(s?.[6] ?? 0), gross = price * sold, toPool = (gross * bps) / 10_000, pool = n(s?.[3]);
    out.pass = {
      address: pass, owner, paused, treasury, prizeBps: bps, price, sold, gross, toPool, toTreasury: gross - toPool,
      pool, sponsorsAndRollovers: Math.max(0, pool - toPool), claimed: n(s?.[4]), treasuryOwed: n(owed),
      balance: n(await publicClient.getBalance({ address: pass }).catch(() => 0n)),
      end: Number(s?.[1] ?? 0) * 1000, claimDeadline: Number(s?.[2] ?? 0) * 1000, rootSet: !!s && !/^0x0+$/.test(s[5]),
    };
  }
  if (shop) {
    const burnBps = next<number>() ?? 0, prizeBps = next<number>() ?? 0, treasury = next<Address>() ?? null, prizeVault = next<Address>() ?? null, owner = next<Address>() ?? null, paused = next<boolean>() ?? false;
    const items = SHOP_ITEMS.map((it) => {
      const r = next<readonly [bigint, number, number, number, boolean, bigint]>();
      const price = n(r?.[0]), sold = Number(r?.[2] ?? 0);
      return { id: it.id, name: it.name, price, sold, supply: Number(r?.[1] ?? 0), active: !!r?.[4], gross: price * sold };
    });
    const gross = items.reduce((a, b) => a + b.gross, 0), burned = (gross * burnBps) / 10_000, toPrize = (gross * prizeBps) / 10_000;
    out.shop = { address: shop, owner, paused, treasury, prizeVault, burnBps, prizeBps, items, gross, burned, toPrize, toTreasury: gross - burned - toPrize };
  }
  if (vault) {
    const bal = n(next<bigint>()), committed = n(next<bigint>()), owner = next<Address>() ?? null, paused = next<boolean>() ?? false;
    const s = next<readonly [bigint, bigint, bigint, `0x${string}`, bigint, bigint]>();
    out.vault = { address: vault, owner, paused, balance: bal, committed, free: Math.max(0, bal - committed), pool: n(s?.[4]), claimed: n(s?.[5]), rootSet: !!s && !/^0x0+$/.test(s[3]) };
  }

  const tAddrs = [...new Set([out.pass?.treasury, out.shop?.treasury].filter((a): a is Address => !!a))];
  out.treasuries = await Promise.all(tAddrs.map(async (address) => {
    const [mon, chog] = await Promise.all([
      publicClient.getBalance({ address }).catch(() => 0n),
      publicClient.readContract({ address: CHOG_TOKEN, abi: erc20, functionName: 'balanceOf', args: [address] }).catch(() => 0n),
    ]);
    return { address, mon: n(mon), chog: n(chog) };
  }));

  await kv().set(`inc:snap:${dayKey()}`, snapshotOf(out), 400 * 86_400).catch(() => undefined);
  return out;
}

export interface Snapshot { passGross: number; passTreasury: number; passSold: number; pool: number; shopGross: number; shopTreasury: number; shopBurned: number }

const snapshotOf = (i: Income): Snapshot => ({
  passGross: i.pass?.gross ?? 0, passTreasury: i.pass?.toTreasury ?? 0, passSold: i.pass?.sold ?? 0, pool: i.pass?.pool ?? 0,
  shopGross: i.shop?.gross ?? 0, shopTreasury: i.shop?.toTreasury ?? 0, shopBurned: i.shop?.burned ?? 0,
});

/** Daily revenue from successive snapshots, oldest first. A day with no snapshot carries the last one forward. */
export async function incomeSeries(days = 30) {
  const list = Array.from({ length: days + 1 }, (_, k) => dayKey(Date.now() - (days - k) * 86_400_000));
  const snaps = await kv().mget<Snapshot>(list.map((d) => `inc:snap:${d}`));
  const out: { day: string; mon: number; chog: number; passes: number; snapshot: boolean }[] = [];
  let prev: Snapshot | null = null;
  snaps.forEach((s, k) => {
    const cur = s ?? prev;
    if (k > 0) out.push({
      day: list[k],
      mon: cur && prev ? Math.max(0, cur.passGross - prev.passGross) : 0,
      chog: cur && prev ? Math.max(0, cur.shopGross - prev.shopGross) : 0,
      passes: cur && prev ? Math.max(0, cur.passSold - prev.passSold) : 0,
      snapshot: !!s,
    });
    if (cur) prev = cur;
  });
  return out;
}

export interface FeedEntry { t: number; hash: string; kind: 'pass' | 'sponsor' | 'shop'; who: Address; amount: number; asset: 'MON' | 'CHOG'; note?: string }

/**
 * The app reports each purchase's transaction hash after it lands; the server reads the receipt
 * and keeps only events emitted by our own contracts, so a forged hash adds nothing.
 */
export async function recordReceipt(hash: `0x${string}`): Promise<number> {
  if (await kv().get(`rcpt:${hash}`)) return 0;
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 15_000 }).catch(() => null);
  if (!receipt || receipt.status !== 'success') return 0;
  await kv().set(`rcpt:${hash}`, 1, 30 * 86_400);
  const pass = PASS_ADDRESS.toLowerCase(), shop = SHOP_ADDRESS.toLowerCase();
  let added = 0;
  for (const log of receipt.logs) {
    const at = log.address.toLowerCase();
    let e: FeedEntry | null = null;
    try {
      if (pass && at === pass) {
        const d = decodeEventLog({ abi: passAbi, data: log.data, topics: log.topics });
        if (d.eventName === 'PassBought') e = { t: Date.now(), hash, kind: 'pass', who: d.args.buyer, amount: n(d.args.price), asset: 'MON' };
        if (d.eventName === 'Sponsored') e = { t: Date.now(), hash, kind: 'sponsor', who: d.args.from, amount: n(d.args.amount), asset: 'MON', note: d.args.note.slice(0, 80) };
      } else if (shop && at === shop) {
        const d = decodeEventLog({ abi: shopAbi, data: log.data, topics: log.topics });
        if (d.eventName === 'Purchased') e = { t: Date.now(), hash, kind: 'shop', who: d.args.buyer, amount: n(d.args.total), asset: 'CHOG', note: SHOP_ITEMS.find((x) => BigInt(x.id) === d.args.itemId)?.name };
      }
    } catch { /* not one of ours */ }
    if (e) { await kv().zadd('inc:feed', e.t + added, JSON.stringify(e)); added++; }
  }
  return added;
}

export async function incomeFeed(n = 25): Promise<FeedEntry[]> {
  return (await kv().ztop('inc:feed', n)).map((r) => JSON.parse(r.member) as FeedEntry);
}
