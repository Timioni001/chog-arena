'use client';

import { PenLine } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useGame } from '@/lib/store';
import { useLoadout } from '@/lib/hooks';
import { checkName } from '@/game/moderation';
import { track } from '@/lib/analytics';
import { sfx } from '@/lib/sound';
import { ChogSprite } from './ChogSprite';
import { Button, Modal, toast } from './ui';

/** Asks a holder to name their Chog the first time it shows up after connecting a wallet. */
export function NameChogPrompt() {
  const lo = useLoadout();
  const address = useGame((s) => s.address);
  const tutorialDone = useGame((s) => s.tutorialDone);
  const prompted = useGame((s) => (lo.tokenId === null ? true : s.namePrompted.includes(lo.tokenId)));
  const skip = useGame((s) => s.skipNaming);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // A short delay lets the wallet toast and the Chog swap land first.
    if (!address || !tutorialDone || lo.tokenId === null || lo.nickname || prompted) return setOpen(false);
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [address, tutorialDone, lo.tokenId, lo.nickname, prompted]);

  if (lo.tokenId === null) return null;
  const later = () => { skip(lo.tokenId!); setOpen(false); };
  return (
    <Modal open={open} onClose={later}>
      <div className="flex flex-col items-center text-center">
        <ChogSprite look={lo.look} size={112} />
        <div className="eyebrow mt-3">{lo.profile.name} joined the arena</div>
        <h2 className="mt-1 font-display text-2xl font-semibold">Give your Chog a name</h2>
        <p className="mt-1 text-sm text-dim">It shows on the leaderboards, in battles and on your share cards. You can change it any time in Profile.</p>
      </div>
      <NameChogForm className="mt-5" autoFocus onDone={() => setOpen(false)} secondary={<Button tone="ghost" onClick={later}>Later</Button>} />
    </Modal>
  );
}

/** Name field for the active Chog, used by the prompt and on the Profile screen. */
export function NameChogForm({ className = '', autoFocus, onDone, secondary }: { className?: string; autoFocus?: boolean; onDone?: () => void; secondary?: React.ReactNode }) {
  const lo = useLoadout();
  const nameChog = useGame((s) => s.nameChog);
  const id = useId();
  const [value, setValue] = useState(lo.nickname ?? '');
  useEffect(() => setValue(lo.nickname ?? ''), [lo.tokenId, lo.nickname]);
  if (lo.tokenId === null) return null;
  const check = value.trim() ? checkName(value) : null;
  const error = check && !check.ok ? check.reason : null;
  const changed = (check?.ok ? check.value : '') !== (lo.nickname ?? '');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!check?.ok) return;
    nameChog(lo.tokenId!, check.value);
    track('chog_named');
    sfx.coin();
    toast.good(`Say hi to ${check.value}!`);
    onDone?.();
  };
  return (
    <form onSubmit={save} className={className}>
      <label htmlFor={id} className="sr-only">Chog name</label>
      <div className={`flex items-center gap-2 rounded-2xl border bg-panel-2 px-3 focus-within:border-chog-2 ${error ? 'border-danger/60' : 'border-line'}`}>
        <PenLine size={16} className="shrink-0 text-dim" />
        <input id={id} name="chog-name" autoFocus={autoFocus} value={value} maxLength={20} onChange={(e) => setValue(e.target.value)} placeholder={lo.profile.name} aria-invalid={!!error} aria-describedby={`${id}-hint`} className="min-w-0 flex-1 bg-transparent py-3" style={{ outline: 'none' }} />
        <span className="text-xs tabular-nums text-dim">{value.trim().length}/20</span>
      </div>
      <p id={`${id}-hint`} className={`mt-1.5 text-xs ${error ? 'text-danger' : 'text-dim'}`}>{error ?? 'Letters, numbers and spaces. Keep it friendly: names are public.'}</p>
      <div className="mt-4 flex gap-2">
        {secondary}
        <Button type="submit" className="flex-1" disabled={!check?.ok || !changed}>Save name</Button>
      </div>
      {lo.nickname && (
        <button type="button" className="mt-3 text-xs text-dim underline" onClick={() => { nameChog(lo.tokenId!, ''); toast.info(`Back to ${lo.profile.name}.`); }}>
          Use the collection name ({lo.profile.name})
        </button>
      )}
    </form>
  );
}
