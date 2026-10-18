'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame, Shield, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { appearanceOf } from '@/lib/appearance';
import { profileForToken } from '@/game/chog';
import { useLoadout } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { ChogSprite } from '../ChogSprite';
import { Button, ElementBadge, Modal, Panel, Pill, Tabs, Title, toast } from '../ui';
import { shortAddr } from '@/lib/hooks';
import type { Element } from '@/game/types';
import { SEASON } from '@/game/season';
import { SeasonPrizes } from '../SeasonPrizes';
import { CLAN_CHEST, claimClanChest } from '@/game/progress';
import { useGame } from '@/lib/store';
import { useProgress } from '@/lib/hooks';
import { sfx } from '@/lib/sound';

interface Row { rank: number; tokenId: number; name: string; score: number; mmr: number; wins: number; games: number; streak: number; element: Element; archetype: string; tier: string | null; clanId: string | null; address: string | null }
interface ClanRow { rank: number; id: string; name: string; tag: string; members: number[]; points: number; leader: number }

type Board = 'season' | 'weekly' | 'rookie' | 'tier' | 'trait' | 'clan';

export function RanksScreen() {
  const lo = useLoadout();
  const [board, setBoard] = useState<Board>('season');
  const traitOptions = useMemo(() => lo.profile.traits.filter((t) => ['Head', 'Eyes', 'Mouth', 'Body', 'Accessory', 'Aura', 'Base', 'Skin'].includes(t.type)), [lo.profile.traits]);
  const [trait, setTrait] = useState(0);
  const [tier, setTier] = useState(lo.profile.tier ?? 'Common');
  const key = board === 'trait' ? `trait:${traitOptions[trait]?.type}:${traitOptions[trait]?.value}` : board === 'tier' ? `tier:${tier}` : board;
  const q = useQuery({ queryKey: ['lb', key], queryFn: () => api<{ rows: (Row | ClanRow)[]; store?: string }>(`/api/leaderboard?board=${encodeURIComponent(key)}`), enabled: board !== 'trait' || traitOptions.length > 0, refetchInterval: 20_000 });

  return (
    <div className="space-y-4">
      <Title sub={`${SEASON.name} · weekly snapshots, season-end prize root committed onchain`}>Leaderboards</Title>
      <SeasonPrizes />
      <Tabs value={board} onChange={setBoard} items={[{ id: 'season', label: 'Season' }, { id: 'weekly', label: 'Weekly' }, { id: 'rookie', label: 'Rookies' }, { id: 'tier', label: 'By tier' }, { id: 'trait', label: 'By trait' }, { id: 'clan', label: 'Clans' }]} />
      {board === 'tier' && (
        <div className="scroll-x flex gap-2">{['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map((t) => <Button key={t} size="sm" tone={tier === t ? 'chog' : 'panel'} onClick={() => setTier(t)}>{t}</Button>)}</div>
      )}
      {board === 'trait' && (
        traitOptions.length ? (
          <div className="scroll-x flex gap-2">{traitOptions.map((t, i) => <Button key={`${t.type}${t.value}`} size="sm" tone={trait === i ? 'chog' : 'panel'} onClick={() => setTrait(i)}>{t.type}: {t.value}</Button>)}</div>
        ) : <Panel className="text-sm text-dim">Trait boards rank Chogs that share one of your traits. Connect a wallet with a Chog to see yours.</Panel>
      )}

      {board === 'clan' ? <Clans rows={(q.data?.rows ?? []) as ClanRow[]} loading={q.isLoading} /> : (
        <Panel className="!p-2">
          {q.isLoading ? <div className="p-6 text-center text-dim">Loading…</div> : q.isError ? <div className="p-6 text-center text-dim">{(q.error as Error).message}</div> : (q.data?.rows.length ?? 0) === 0 ? (
            <div className="p-8 text-center">
              <div className="font-display text-xl">No ranked results yet</div>
              <p className="mt-1 text-sm text-dim">Every row here is a real, server-verified ranked match. Be the first on this board.</p>
            </div>
          ) : (
            <ol className="divide-y divide-line">
              {(q.data!.rows as Row[]).map((r) => <LbRow key={r.tokenId} r={r} me={r.tokenId === lo.tokenId} />)}
            </ol>
          )}
        </Panel>
      )}
      <Panel className="text-sm text-dim">
        <div className="mb-1 flex items-center gap-2 font-semibold text-ink"><Shield size={16} /> Fair-play rules</div>
        <ul className="list-disc space-y-1 pl-5">
          <li>Scores come only from matches the server replays from seed and moves. Clients can’t submit scores.</li>
          <li>Ownership is checked onchain at match start and finish. A Chog that changes hands sits out prize boards for 24h.</li>
          <li>Tap rate is capped at 15/s and offline earnings at your cap. Over-the-limit input is ignored, never punished silently.</li>
          <li>Holding more Chogs gives at most +15% total stat bonus. Matchmaking is by MMR.</li>
          <li>Flagged accounts are listed below with the reason, and can appeal in the Chog Discord.</li>
        </ul>
      </Panel>
      <FlagList />
    </div>
  );
}

function FlagList() {
  const q = useQuery({ queryKey: ['flags'], queryFn: () => api<{ flags: { tokenId: number; reason: string; at: number; until: number | null }[] }>('/api/flags'), staleTime: 60_000 });
  const flags = q.data?.flags ?? [];
  return (
    <Panel>
      <div className="eyebrow mb-1.5">Transparency</div>
      <div className="mb-2 font-display text-xl font-semibold">Flagged Chogs</div>
      {flags.length === 0 ? (
        <p className="text-sm text-dim">No Chogs are flagged right now.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {flags.map((f) => (
            <li key={f.tokenId} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span className="font-semibold">Token #{f.tokenId}</span>
              <span className="min-w-0 flex-1 text-dim">{f.reason}</span>
              <span className="text-xs text-dim">{new Date(f.at).toLocaleDateString()}{f.until ? ` → ${new Date(f.until).toLocaleDateString()}` : ' · until reviewed'}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-dim">Flagged Chogs can still play casual modes but sit out ranked and prize boards. Appeals: <a className="underline" href="https://discord.com/invite/chog" target="_blank" rel="noreferrer">Chog Discord</a>.</p>
    </Panel>
  );
}

function ClanChest({ points }: { points: number }) {
  const p = useProgress();
  const update = useGame((s) => s.update);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {CLAN_CHEST.map((c) => {
        const claimed = (p.clanChest ?? []).includes(`${SEASON.id}:${c.at}`);
        const ready = points >= c.at && !claimed;
        return (
          <button key={c.at} disabled={!ready} onClick={() => { if (update((cur) => claimClanChest(cur, SEASON.id, c.at, points))) { sfx.coin(); toast.good(`Clan chest opened: +${c.sparks.toLocaleString()} Sparks${c.cosmetic ? ' and the Clan frame' : ''}!`); } }}
            className={`rounded-2xl border p-3 text-left transition ${ready ? 'border-gold bg-gold/10' : 'border-line bg-panel-2'} disabled:cursor-default`}>
            <div className="text-xs text-dim">{c.at.toLocaleString()} pts</div>
            <div className="text-sm font-semibold">{claimed ? 'Opened' : ready ? 'Open chest' : `${Math.min(points, c.at).toLocaleString()} / ${c.at.toLocaleString()}`}</div>
            <div className="text-[11px] text-dim">+{c.sparks.toLocaleString()} Sparks{c.cosmetic ? ' + frame' : ''}</div>
          </button>
        );
      })}
    </div>
  );
}

function LbRow({ r, me }: { r: Row; me: boolean }) {
  const look = useMemo(() => appearanceOf(profileForToken(r.tokenId)), [r.tokenId]);
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${me ? 'bg-chog/15' : ''}`}>
      <span className={`w-8 text-center font-display text-lg ${r.rank <= 3 ? 'text-gold' : 'text-dim'}`}>{r.rank}</span>
      <ChogSprite look={look} size={44} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{r.name}{me && <span className="ml-1 text-xs text-chog-2">(you)</span>}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-dim">
          <ElementBadge element={r.element} />
          {r.tier && <span>{r.tier}</span>}
          {r.streak > 1 && <span className="flex items-center text-cheek"><Flame size={12} />{r.streak}</span>}
          {r.address && <span>{shortAddr(r.address)}</span>}
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-lg">{r.score.toLocaleString()}</div>
        <div className="text-[11px] text-dim">{r.mmr} MMR · {r.wins}/{r.games}</div>
      </div>
    </li>
  );
}

function Clans({ rows, loading }: { rows: ClanRow[]; loading: boolean }) {
  const lo = useLoadout();
  const { signedIn, signIn } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const mine = rows.find((c) => lo.tokenId !== null && c.members.includes(lo.tokenId));

  const act = async (body: Record<string, unknown>) => {
    if (lo.tokenId === null) return toast.bad('Clans need a Chog.');
    try {
      if (!signedIn) await signIn();
      await api('/api/clans', { json: { ...body, tokenId: lo.tokenId } });
      await qc.invalidateQueries({ queryKey: ['lb', 'clan'] });
      toast.good('Clan updated.');
      setOpen(false);
    } catch (e) {
      toast.bad((e as Error).message.split('\n')[0]);
    }
  };

  return (
    <div className="space-y-3">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Users className="text-chog-2" />
          <div className="min-w-0 flex-1">
            {mine ? <><div className="font-semibold">[{mine.tag}] {mine.name}</div><div className="text-sm text-dim">{mine.members.length} members · {mine.points.toLocaleString()} season pts</div></> : <><div className="font-semibold">Clans</div><div className="text-sm text-dim">Holders create and lead clans. Members’ ranked points fill the clan chest.</div></>}
          </div>
          {mine ? <Button size="sm" tone="ghost" onClick={() => act({ action: 'leave' })}>Leave</Button> : <Button size="sm" disabled={!lo.isHolder} onClick={() => setOpen(true)}>Create clan</Button>}
        </div>
        {mine && <ClanChest points={mine.points} />}
      </Panel>
      <Panel className="!p-2">
        {loading ? <div className="p-6 text-center text-dim">Loading…</div> : rows.length === 0 ? <div className="p-6 text-center text-dim">No clans yet. Start the first one.</div> : (
          <ol className="divide-y divide-line">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-2 py-2.5">
                <span className="w-8 text-center font-display text-lg text-dim">{c.rank}</span>
                <Pill color="#a98bff">{c.tag}</Pill>
                <div className="min-w-0 flex-1 truncate font-semibold">{c.name}</div>
                <span className="text-xs text-dim">{c.members.length}/30</span>
                <span className="w-20 text-right font-display">{c.points.toLocaleString()}</span>
                {!mine && lo.isHolder && <Button size="sm" tone="panel" onClick={() => act({ action: 'join', clanId: c.id })}>Join</Button>}
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="Create a clan">
        <label className="block text-sm font-bold">Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className="mt-1 w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5" placeholder="Quill Gang" /></label>
        <label className="mt-3 block text-sm font-bold">Tag (2–4)<input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} maxLength={4} className="mt-1 w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5 uppercase" placeholder="QUIL" /></label>
        <Button className="mt-4 w-full" onClick={() => act({ action: 'create', name, tag })}>Create</Button>
      </Modal>
    </div>
  );
}
