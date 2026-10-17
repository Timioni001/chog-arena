'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, LogOut, ShieldCheck, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { ChogSprite } from '../ChogSprite';
import { Button, Panel, Pill, Tabs, Title, toast } from '../ui';
import { useGame } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { shortAddr, useLoadout } from '@/lib/hooks';
import { appearanceOf } from '@/lib/appearance';
import { profileForToken } from '@/game/chog';
import { newProgress } from '@/game/progress';
import { api } from '@/lib/api';
import { COLLECTION } from '@/game/collection';
import { CHOG_TOKEN } from '@/lib/wagmi';

export function ProfileScreen() {
  const { address, connector } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signedIn, signIn, signOut } = useAuth();
  const owned = useGame((s) => s.ownedTokens);
  const activeKey = useGame((s) => s.activeKey);
  const selectChog = useGame((s) => s.selectChog);
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const replace = useGame((s) => s.replaceProgress);
  const finishTutorial = useGame((s) => s.finishTutorial);
  const lo = useLoadout();
  const health = useQuery({ queryKey: ['health'], queryFn: () => api<{ store: string; attestations: boolean; collection: { indexedAt: string } }>('/api/health') });

  return (
    <div className="space-y-4">
      <Title>Profile</Title>
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Wallet className="text-chog-2" />
          <div className="min-w-0 flex-1">
            <div className="font-extrabold">{address ? shortAddr(address) : 'No wallet connected'}</div>
            <div className="text-sm text-dim">{address ? `${connector?.name ?? 'Wallet'} · ${owned.length} Chog${owned.length === 1 ? '' : 's'} found` : 'Connect to load your Chogs. Playing the demo needs no wallet.'}</div>
          </div>
          {address && <Button tone="ghost" size="sm" onClick={() => { disconnect(); void signOut(); }}><LogOut size={16} /> Disconnect</Button>}
        </div>
        {!address && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {connectors.map((c) => (
              <Button key={c.uid} tone="panel" disabled={isPending} onClick={() => connect({ connector: c }, { onError: (e) => toast.bad(e.message.split('\n')[0]) })}>
                {c.name === 'Injected' ? 'Browser wallet' : c.name}
              </Button>
            ))}
          </div>
        )}
        {address && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {signedIn ? (
              <Pill color="#39ff6a"><ShieldCheck size={12} /> Signed in: ranked, clans and cloud saves enabled</Pill>
            ) : (
              <Button size="sm" tone="gold" onClick={() => signIn().then(() => toast.good('Signed in.')).catch((e: Error) => toast.bad(e.message.split('\n')[0]))}>Sign in (free, no gas)</Button>
            )}
          </div>
        )}
      </Panel>

      {owned.length > 0 && (
        <Panel>
          <Title sub="Progress belongs to each Chog. Switch any time.">Your Chogs</Title>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {owned.slice(0, 50).map((id) => <ChogPick key={id} id={id} active={activeKey === `chog:${id}`} onPick={() => selectChog(id)} />)}
          </div>
        </Panel>
      )}
      {address && owned.length === 0 && (
        <Panel className="text-sm">
          No Chog Genesis found in this wallet. Pick one up on{' '}
          <a className="font-bold text-chog-2 underline" href="https://opensea.io/collection/chog-genesis" target="_blank" rel="noreferrer">OpenSea</a> to unlock ranked play, prizes and your real traits.
        </Panel>
      )}

      <Panel>
        <Title>Settings</Title>
        <div className="space-y-4">
          <Row label="Graphics" hint="Auto picks Low on older phones. Low turns off outlines and particles.">
            <Tabs value={settings.quality} onChange={(v) => setSettings({ quality: v })} items={[{ id: 'auto', label: 'Auto' }, { id: 'low', label: 'Low' }, { id: 'medium', label: 'Med' }, { id: 'high', label: 'High' }]} />
          </Row>
          <Row label="Theme"><Tabs value={settings.theme} onChange={(v) => setSettings({ theme: v })} items={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }]} /></Row>
          <Toggle label="Sound effects" on={settings.sound} set={(v) => setSettings({ sound: v })} />
          <Toggle label="Haptics" on={settings.haptics} set={(v) => setSettings({ haptics: v })} />
          <Toggle label="Reduce motion" hint="Calmer animations, no screen shake or particles." on={settings.reducedMotion} set={(v) => setSettings({ reducedMotion: v })} />
          <Toggle label="Hide my wallet on leaderboards" on={settings.hideWallet} set={(v) => setSettings({ hideWallet: v })} />
          <Row label="Display name" hint="Shown on leaderboards instead of your Chog number.">
            <input value={settings.displayName} maxLength={20} onChange={(e) => setSettings({ displayName: e.target.value })} className="w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5 sm:w-64" placeholder={lo.profile.name} />
          </Row>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" tone="panel" onClick={() => useGame.setState({ tutorialDone: false })}>Replay tutorial</Button>
            {!lo.isHolder && <Button size="sm" tone="ghost" onClick={() => { replace('guest', newProgress()); finishTutorial(); toast.info('Demo progress reset.'); }}>Reset demo progress</Button>}
          </div>
        </div>
      </Panel>

      <Panel className="space-y-2 text-sm text-dim">
        <div className="font-extrabold text-ink">About</div>
        <p>Chog Arena reads the Chog Genesis collection (<a className="underline" href={`https://monadvision.com/address/${COLLECTION.contract}`} target="_blank" rel="noreferrer">{shortAddr(COLLECTION.contract)}</a>, {COLLECTION.supply} tokens) on Monad. $CHOG: <a className="underline" href={`https://monadvision.com/token/${CHOG_TOKEN}`} target="_blank" rel="noreferrer">{shortAddr(CHOG_TOKEN)}</a>.</p>
        <p>All character art is original and generated from your traits. We never use or host NFT images.</p>
        <p>Contracts are unaudited and launch with per-wallet and per-day caps.</p>
        {health.data && <p className="text-xs">Server: {health.data.store} store · attestations {health.data.attestations ? 'on' : 'off'} · traits indexed {new Date(health.data.collection.indexedAt).toLocaleDateString()}</p>}
      </Panel>
    </div>
  );
}

function ChogPick({ id, active, onPick }: { id: number; active: boolean; onPick: () => void }) {
  const look = useMemo(() => appearanceOf(profileForToken(id)), [id]);
  const p = useMemo(() => profileForToken(id), [id]);
  return (
    <button onClick={onPick} className={`relative rounded-2xl border-2 p-1.5 text-center ${active ? 'border-gold bg-gold/10' : 'border-line bg-panel-2'}`} aria-pressed={active}>
      <ChogSprite look={look} size={80} className="mx-auto" />
      <div className="truncate text-xs font-extrabold">{p.name}</div>
      <div className="text-[10px] text-dim">{p.tier}</div>
      {active && <Check size={16} className="absolute right-1.5 top-1.5 text-gold" />}
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-bold">{label}</div>
        {hint && <div className="text-xs text-dim">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, hint, on, set }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <Row label={label} hint={hint}>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-chog' : 'bg-line'}`}>
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
      </button>
    </Row>
  );
}
