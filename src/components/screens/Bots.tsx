'use client';

import { Lock, Merge, Plus, Recycle, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { formatUnits } from 'viem';
import { BOT_SPECIES, botYield, canMerge, MAX_BOT_LEVEL, mergeCost, speciesOf, type OwnedBot } from '@/game/bots';
import { buyBot, equipBot, mergeBots, passiveRate, scrapBot, unequipBot } from '@/game/progress';
import { BotSprite } from '../BotSprite';
import { CardView } from '../CardView';
import { Button, ElementBadge, Modal, Panel, Pill, Spark, Tabs, Title, toast } from '../ui';
import { fmt, useLoadout, useProgress } from '@/lib/hooks';
import { useGame } from '@/lib/store';
import { botCard } from '@/game/bots';
import { sfx } from '@/lib/sound';
import { CHOG_TOKEN, SHOP_ADDRESS, erc20Abi, shopAbi } from '@/lib/wagmi';

const RARITY_COLOR: Record<string, string> = { common: '#a59cc9', uncommon: '#5ee36a', rare: '#2fc6ff', epic: '#c084fc', legendary: '#ffd166', mythic: '#ff7ad9' };

export function BotsScreen() {
  const [tab, setTab] = useState<'dash' | 'shop' | 'chog'>('dash');
  return (
    <div className="space-y-4">
      <Title sub="Bots earn Sparks around the clock and join your battle deck.">Bots</Title>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'dash', label: 'Dashboard' }, { id: 'shop', label: 'Spark shop' }, { id: 'chog', label: '$CHOG shop' }]} />
      {tab === 'dash' && <Dashboard />}
      {tab === 'shop' && <SparkShop />}
      {tab === 'chog' && <ChogShop />}
    </div>
  );
}

function Dashboard() {
  const p = useProgress();
  const lo = useLoadout();
  const update = useGame((s) => s.update);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<OwnedBot | null>(null);
  const equipped = p.equipped.map((u) => p.bots.find((b) => b.uid === u)).filter((b): b is OwnedBot => !!b).slice(0, lo.slots);
  const rate = passiveRate(p, lo.yieldBonus);
  const sel = selected.map((u) => p.bots.find((b) => b.uid === u)).filter((b): b is OwnedBot => !!b);
  const mergeable = sel.length === 2 && canMerge(sel[0], sel[1]);

  const toggle = (uid: string) => setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s.slice(-1), uid]));
  const doMerge = () => {
    if (!mergeable) return;
    const cost = mergeCost(sel[0].level);
    if (!update((cur) => mergeBots(cur, sel[0].uid, sel[1].uid, Date.now()))) return toast.bad(`Merging needs ${fmt(cost)} Sparks.`);
    sfx.level();
    toast.good(`${speciesOf(sel[0]).name} reached level ${sel[0].level + 1}!`);
    setSelected([]);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-dim">Passive income</div>
            <div className="flex items-center gap-1 font-pixel text-3xl"><Spark /> {fmt(rate)}<span className="text-base text-dim">/h</span></div>
          </div>
          <Pill>{lo.slots} slot{lo.slots > 1 ? 's' : ''} · offline cap {lo.offlineHours}h</Pill>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => {
            const b = equipped[i];
            const locked = i >= lo.slots;
            return (
              <div key={i} className={`relative grid aspect-[4/5] place-items-center rounded-3xl border-2 ${locked ? 'border-dashed border-line bg-panel-2/40' : b ? 'border-chog bg-panel-2' : 'border-dashed border-chog/60 bg-panel-2/60'}`}>
                {locked ? (
                  <div className="px-2 text-center text-xs text-dim"><Lock className="mx-auto mb-1" size={20} />{i === 1 ? 'Holder slot' : 'Rare+ Chog slot'}</div>
                ) : b ? (
                  <button className="flex flex-col items-center" onClick={() => setDetail(b)}>
                    <BotSprite species={speciesOf(b)} level={b.level} size={72} />
                    <div className="mt-1 text-xs font-extrabold">{speciesOf(b).name}</div>
                    <div className="text-[11px] text-dim">{fmt(botYield(b, lo.yieldBonus))}/h</div>
                  </button>
                ) : (
                  <div className="px-2 text-center text-xs text-dim"><Plus className="mx-auto mb-1" size={22} />Equip a bot below</div>
                )}
                {b && (
                  <button aria-label="Unequip" onClick={() => update((cur) => unequipBot(cur, b.uid))} className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-black/30 text-dim">
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <Title sub="Pick two of the same bot at the same level to merge them." right={<Button size="sm" tone="lime" disabled={!mergeable} onClick={doMerge}><Merge size={16} /> Merge{mergeable ? ` · ${fmt(mergeCost(sel[0].level))}` : ''}</Button>}>Inventory</Title>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {p.bots.map((b) => {
            const s = speciesOf(b);
            const on = p.equipped.includes(b.uid);
            const picked = selected.includes(b.uid);
            return (
              <div key={b.uid} className={`relative rounded-2xl border-2 p-2 text-center transition ${picked ? 'border-gold bg-gold/10' : 'border-line bg-panel-2'}`}>
                <button className="w-full" onClick={() => toggle(b.uid)} aria-pressed={picked} aria-label={`${s.name} level ${b.level}${on ? ', equipped' : ''}`}>
                  <BotSprite species={s} level={b.level} size={60} />
                  <div className="truncate text-xs font-extrabold">{s.name}</div>
                  <div className="text-[10px]" style={{ color: RARITY_COLOR[s.rarity] }}>{s.rarity}</div>
                </button>
                <Button size="sm" tone={on ? 'ghost' : 'chog'} className="mt-1 w-full !min-h-8 !text-xs" onClick={() => {
                  if (on) update((cur) => unequipBot(cur, b.uid));
                  else if (!update((cur) => equipBot(cur, b.uid, lo.slots))) toast.bad('Could not equip.');
                }}>{on ? 'Unequip' : 'Equip'}</Button>
              </div>
            );
          })}
        </div>
      </Panel>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${speciesOf(detail).name} · Lv ${detail.level}` : ''}>
        {detail && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <BotSprite species={speciesOf(detail)} level={detail.level} size={96} />
              <div className="space-y-1 text-sm">
                <ElementBadge element={speciesOf(detail).element} />
                <p className="text-dim">{speciesOf(detail).blurb}</p>
                <p><b>{fmt(botYield(detail, lo.yieldBonus))}</b> Sparks/h{detail.level < MAX_BOT_LEVEL && <span className="text-dim"> → {fmt(botYield({ ...detail, level: detail.level + 1 }, lo.yieldBonus))} at Lv {detail.level + 1}</span>}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CardView def={botCard(detail)} size="lg" />
              <p className="text-sm text-dim">Equipped bots add this card to your battle deck. It gains +1 power every 3 levels.</p>
            </div>
            <Button tone="ghost" className="w-full" onClick={() => {
              if (update((cur) => scrapBot(cur, detail.uid))) { toast.info('Bot scrapped for parts.'); setDetail(null); }
              else toast.bad('You need at least one bot.');
            }}><Recycle size={16} /> Scrap for {fmt(Math.round(speciesOf(detail).price * 0.3 * detail.level))}</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SparkShop() {
  const p = useProgress();
  const update = useGame((s) => s.update);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {BOT_SPECIES.map((s) => (
        <Panel key={s.id} className="flex flex-col">
          <div className="flex items-center gap-3">
            <BotSprite species={s} size={72} />
            <div className="min-w-0">
              <div className="font-extrabold">{s.name}</div>
              <div className="text-xs font-bold capitalize" style={{ color: RARITY_COLOR[s.rarity] }}>{s.rarity}</div>
              <div className="mt-1"><ElementBadge element={s.element} /></div>
            </div>
          </div>
          <p className="mt-2 flex-1 text-sm text-dim">{s.blurb} Earns {s.yield}/h at Lv 1. Card: <b className="text-ink">{s.card.name}</b>.</p>
          <Button className="mt-3" tone={p.sparks >= s.price ? 'gold' : 'panel'} disabled={p.sparks < s.price} onClick={() => {
            if (update((cur) => buyBot(cur, s.id, Date.now()))) { sfx.coin(); toast.good(`${s.name} joined your crew!`); }
          }}>
            <ShoppingBag size={16} /> <Spark /> {fmt(s.price)}
          </Button>
        </Panel>
      ))}
    </div>
  );
}

const CHOG_ITEMS = [
  { id: 1, name: 'Arena Frame: Neon', text: 'Cosmetic profile frame. Pure flex.' },
  { id: 2, name: 'Zap Kite (onchain)', text: 'Mints a ChogBots ERC-1155 you can equip, trade or burn.' },
  { id: 3, name: 'Season Entry Pass', text: 'Joins the weekly $CHOG tournament bracket.' },
];

function ChogShop() {
  const { address } = useAccount();
  const lo = useLoadout();
  const configured = !!SHOP_ADDRESS;
  const balance = useReadContract({ address: CHOG_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address } });
  return (
    <div className="space-y-3">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-dim">Your $CHOG</div>
            <div className="font-pixel text-2xl">{balance.data !== undefined ? Number(formatUnits(balance.data, 18)).toLocaleString('en-US', { maximumFractionDigits: 2 }) : address ? '…' : '—'}</div>
          </div>
          <a className="text-sm font-bold text-chog-2 underline" href={`https://monadvision.com/token/${CHOG_TOKEN}`} target="_blank" rel="noreferrer">Token on explorer</a>
        </div>
        <p className="mt-3 text-sm text-dim">
          $CHOG is never paid out for tapping or referrals. It is spent here, and each purchase is split three ways: a burn, the season prize vault, and the treasury. Season prizes are paid only from that vault, never from new emissions.
        </p>
      </Panel>
      {!configured && (
        <Panel className="border-gold/40 !bg-gold/5 text-sm">
          The shop contract is not deployed on this build yet, so purchases are disabled. Contracts and tests live in <code>/contracts</code>.
        </Panel>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {CHOG_ITEMS.map((it) => <ChogItem key={it.id} item={it} disabled={!configured || !address || !lo.isHolder} />)}
      </div>
    </div>
  );
}

function ChogItem({ item, disabled }: { item: (typeof CHOG_ITEMS)[number]; disabled: boolean }) {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const info = useReadContract({ address: (SHOP_ADDRESS || undefined) as `0x${string}` | undefined, abi: shopAbi, functionName: 'items', args: [BigInt(item.id)], query: { enabled: !!SHOP_ADDRESS } });
  const allowance = useReadContract({ address: CHOG_TOKEN, abi: erc20Abi, functionName: 'allowance', args: address && SHOP_ADDRESS ? [address, SHOP_ADDRESS as `0x${string}`] : undefined, query: { enabled: !!address && !!SHOP_ADDRESS } });
  const price = info.data?.[0];
  const active = info.data?.[4];
  const buy = async () => {
    if (!price || !SHOP_ADDRESS) return;
    try {
      if ((allowance.data ?? 0n) < price) {
        await writeContractAsync({ address: CHOG_TOKEN, abi: erc20Abi, functionName: 'approve', args: [SHOP_ADDRESS as `0x${string}`, price] });
        await allowance.refetch();
      }
      await writeContractAsync({ address: SHOP_ADDRESS as `0x${string}`, abi: shopAbi, functionName: 'buy', args: [BigInt(item.id), 1, price] });
      toast.good(`${item.name} purchased.`);
    } catch (e) {
      toast.bad((e as Error).message.split('\n')[0]);
    }
  };
  return (
    <Panel className="flex flex-col">
      <div className="font-extrabold">{item.name}</div>
      <p className="mt-1 flex-1 text-sm text-dim">{item.text}</p>
      <Button className="mt-3" tone="cheek" disabled={disabled || !price || !active || isPending} onClick={buy}>
        {isPending ? 'Confirm in wallet…' : price ? `${Number(formatUnits(price, 18)).toLocaleString()} $CHOG` : 'Unavailable'}
      </Button>
    </Panel>
  );
}

