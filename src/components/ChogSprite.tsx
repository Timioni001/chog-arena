import { memo } from 'react';
import type { Appearance } from '@/lib/appearance';

/** Star-burst mane polygon around the head, like the character sheets. */
function mane(cx: number, cy: number, rOut: number, rIn: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Flat portrait of a Chog built from the same Appearance as the 3D model. */
export const ChogSprite = memo(function ChogSprite({ look, size = 96, background = true, className }: { look: Appearance; size?: number; background?: boolean; className?: string }) {
  const { eyes, mouth, head } = look;
  const id = `g${Math.abs(hash(JSON.stringify(look))) % 1e9}`;
  const quill = look.skull ? '#e9e0cb' : look.skinShade;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label="Chog portrait">
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={look.bg[0]} />
          <stop offset="100%" stopColor={look.bg[1]} />
        </radialGradient>
        <radialGradient id={`${id}fur`} cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor={look.skin} stopOpacity="1" />
          <stop offset="100%" stopColor={look.skinShade} />
        </radialGradient>
        <radialGradient id={`${id}face`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="100%" stopColor={look.face} />
        </radialGradient>
      </defs>
      {background && <rect width="200" height="200" rx="56" fill={`url(#${id}bg)`} />}
      {look.aura && <circle cx="100" cy="108" r="88" fill={look.aura.color} opacity="0.18" />}
      {/* body + paws */}
      <ellipse cx="100" cy="188" rx="58" ry="30" fill={look.body.kind === 'none' ? look.skin : look.body.color} />
      <ellipse cx="70" cy="196" rx="16" ry="9" fill={look.paws} />
      <ellipse cx="130" cy="196" rx="16" ry="9" fill={look.paws} />
      {/* mane */}
      <polygon points={mane(100, 100, 92, 58, 11)} fill={quill} strokeLinejoin="round" stroke={quill} strokeWidth="6" />
      <circle cx="100" cy="102" r="62" fill={`url(#${id}fur)`} />
      {/* face with tuft */}
      <path d="M100 52 l-8 14 l-8 -8 l2 14 C62 76 52 96 56 116 C60 140 80 150 100 150 C120 150 140 140 144 116 C148 96 138 76 116 72 l2 -14 l-8 8 z" fill={`url(#${id}face)`} />
      {renderEyes(eyes.kind, eyes.color, look.skull)}
      {!look.skull && (
        <g>
          <ellipse cx="64" cy="122" rx="14" ry="7" fill="#ff5fa2" opacity="0.9" transform="rotate(-12 64 122)" />
          <ellipse cx="136" cy="122" rx="14" ry="7" fill="#ff5fa2" opacity="0.9" transform="rotate(12 136 122)" />
          <ellipse cx="100" cy="117" rx="7" ry="4.6" fill="#ff6fae" />
        </g>
      )}
      {look.skull && <path d="M96 116 L104 116 L100 122 Z" fill="#2a1d33" />}
      <g transform="translate(100 130)">{renderMouth(mouth.kind, mouth.color)}</g>
      {renderHead(head.kind, head.color, head.color2, head.text)}
    </svg>
  );
});

function renderEyes(kind: Appearance['eyes']['kind'], color: string, skull: boolean) {
  const L = 80, R = 120, Y = 102;
  const base = skull ? '#2a1d33' : '#1e1030';
  switch (kind) {
    case 'happy':
      return <g fill="none" stroke="#1e1030" strokeWidth="4.5" strokeLinecap="round">{[L, R].map((x) => <path key={x} d={`M${x - 9} ${Y + 3} Q${x} ${Y - 9} ${x + 9} ${Y + 3}`} />)}</g>;
    case 'closed':
      return <g stroke={color} strokeWidth="4" strokeLinecap="round">{[L, R].map((x) => <line key={x} x1={x - 9} y1={Y} x2={x + 9} y2={Y} />)}</g>;
    case 'dead':
      return <g stroke="#1e1030" strokeWidth="4" strokeLinecap="round">{[L, R].map((x) => <g key={x}><line x1={x - 7} y1={Y - 7} x2={x + 7} y2={Y + 7} /><line x1={x + 7} y1={Y - 7} x2={x - 7} y2={Y + 7} /></g>)}</g>;
    case 'heart':
      return <g fill={color}>{[L, R].map((x) => <path key={x} d={`M${x} ${Y + 9} C${x - 15} ${Y - 2} ${x - 7} ${Y - 13} ${x} ${Y - 4} C${x + 7} ${Y - 13} ${x + 15} ${Y - 2} ${x} ${Y + 9} Z`} />)}</g>;
    case 'visor':
      return <g>{[L, R].map((x) => <rect key={x} x={x - 17} y={Y - 11} width="34" height="22" rx="8" fill={color} stroke="#8c8f9c" strokeWidth="3" />)}</g>;
    case 'vr':
      return <rect x="56" y="88" width="88" height="28" rx="10" fill={color} />;
    case 'shades':
      return <g fill={color}><rect x="62" y="93" width="34" height="19" rx="6" /><rect x="104" y="93" width="34" height="19" rx="6" /><rect x="94" y="99" width="12" height="3" fill="#1e1030" /></g>;
    case 'laser':
      return <g>{[L, R].map((x) => <g key={x}><circle cx={x} cy={Y} r="11" fill={color} opacity="0.45" /><circle cx={x} cy={Y} r="5.5" fill="#fff" /></g>)}</g>;
    case 'frog':
      return <g>{[L - 2, R + 2].map((x) => <g key={x}><circle cx={x} cy={Y - 4} r="12" fill="#fff" /><circle cx={x} cy={Y - 3} r="5.5" fill="#1e1030" /></g>)}</g>;
    default: {
      const dx = kind === 'side' ? 3 : 0;
      const dy = kind === 'up' ? -3 : 0;
      return (
        <g>
          {[L, R].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy={Y} rx="10" ry={kind === 'tired' ? 7 : 12} fill={base} />
              <circle cx={x + dx} cy={Y + 3 + dy} r="5" fill={color !== '#1b1424' ? color : '#4a2470'} />
              <circle cx={x + 3.5 + dx} cy={Y - 4 + dy} r="3.6" fill="#fff" />
              <circle cx={x - 3 + dx} cy={Y + 5 + dy} r="1.6" fill="#fff" />
              {kind === 'tired' && <rect x={x - 11} y={Y - 13} width="22" height="8" fill="#f6ead8" />}
              {kind === 'angry' && <line x1={x - 10} y1={Y - 17 + (x < 100 ? -3 : 3)} x2={x + 10} y2={Y - 17 + (x < 100 ? 3 : -3)} stroke="#1e1030" strokeWidth="4" strokeLinecap="round" />}
              {kind === 'cry' && <ellipse cx={x + 7} cy={Y + 18} rx="3" ry="5" fill="#7fd7ff" />}
            </g>
          ))}
        </g>
      );
    }
  }
}

function renderMouth(kind: Appearance['mouth']['kind'], color: string) {
  const ink = '#5a1830';
  const w = <path d="M-9 -1 Q-4.5 5 0 -1 Q4.5 5 9 -1" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />;
  switch (kind) {
    case 'sad':
      return <path d="M-8 4 Q0 -4 8 4" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />;
    case 'flat':
      return <line x1="-7" y1="0" x2="7" y2="0" stroke={ink} strokeWidth="3" strokeLinecap="round" />;
    case 'o':
      return <ellipse rx="4" ry="5" fill="#7a2240" />;
    case 'grit':
      return <rect x="-9" y="-3" width="18" height="7" rx="2" fill="#fff" stroke={ink} strokeWidth="2" />;
    case 'gum':
      return <g>{w}<circle cx="9" cy="8" r="9" fill={color} opacity="0.95" /></g>;
    case 'coin':
      return <circle cx="0" cy="4" r="8" fill={color} />;
    case 'puke':
      return <g>{['#ff6b6b', '#ffb347', '#ffe14d', '#5ee3a0', '#4ee6f0', '#7c4dff'].map((c, i) => <rect key={c} x={-8 + i * 2.7} y="0" width="3" height={14 + (i % 2) * 6} fill={c} />)}</g>;
    case 'clown':
      return <path d="M-13 -2 Q0 11 13 -2" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />;
    case 'grin':
      return <g>{w}<rect x="1" y="2" width="5" height="5" rx="1" fill={color} /></g>;
    case 'drool':
      return <g>{w}<ellipse cx="7" cy="9" rx="2.5" ry="4.5" fill={color} /></g>;
    default:
      return w;
  }
}

function renderHead(kind: Appearance['head']['kind'], color: string, color2: string, text: string | null) {
  switch (kind) {
    case 'cap':
    case 'bucket':
      return (
        <g>
          <path d="M48 62 Q100 4 152 62 Z" fill={color} />
          <path d={kind === 'bucket' ? 'M34 66 L166 66 L156 56 L44 56 Z' : 'M70 60 Q105 52 154 66 L162 72 Q112 64 70 68 Z'} fill={kind === 'bucket' ? color2 : color} />
          {text && <text x="100" y="50" textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff" fontFamily="system-ui">{text}</text>}
        </g>
      );
    case 'beanie':
      return <g><path d="M46 62 Q100 -4 154 62 Z" fill={color} /><rect x="44" y="54" width="112" height="13" rx="6.5" fill="#f4f1ea" /><circle cx="100" cy="16" r="10" fill="#f4f1ea" /></g>;
    case 'crown':
      return <path d="M64 40 L74 12 L87 32 L100 6 L113 32 L126 12 L136 40 Z" fill={color} />;
    case 'wizard':
      return <g><path d="M62 44 L112 -8 L140 44 Z" fill={color} /><ellipse cx="100" cy="46" rx="60" ry="9" fill={color} /></g>;
    case 'helmet':
      return <g><path d="M42 66 Q100 0 158 66 Z" fill={color} /><rect x="94" y="0" width="12" height="38" rx="4" fill={color2} /></g>;
    case 'horns':
      return <g><path d="M56 38 L44 6 L70 30 Z" fill={color} /><path d="M144 38 L156 6 L130 30 Z" fill={color} /></g>;
    case 'halo':
      return <ellipse cx="100" cy="12" rx="34" ry="8" fill="none" stroke={color} strokeWidth="5" />;
    case 'gem':
      return <path d="M100 0 L114 14 L100 30 L86 14 Z" fill={color} />;
    case 'headband':
      return <rect x="44" y="60" width="112" height="11" rx="5.5" fill={color} />;
    case 'durag':
      return <path d="M44 68 Q100 4 156 68 Z" fill={color} />;
    case 'hair':
      return <g>{[54, 76, 100, 124, 146].map((x, i) => <circle key={x} cx={x} cy={44 - (i === 2 ? 14 : 0)} r="23" fill={text === 'rainbow' ? ['#ff6b6b', '#ffe14d', '#5ee3a0', '#4ee6f0', '#ff5fd2'][i] : color} />)}</g>;
    case 'ushanka':
      return <g><rect x="48" y="22" width="104" height="38" rx="14" fill={color} /><rect x="42" y="52" width="116" height="13" rx="6" fill={color2} /></g>;
    case 'clownNose':
      return <circle cx="100" cy="117" r="9" fill={color} />;
    case 'mask':
      return <rect x="56" y="92" width="88" height="20" rx="10" fill={color} opacity="0.9" />;
    case 'thirdEye':
      return <ellipse cx="100" cy="74" rx="6" ry="9" fill={color} />;
    case 'shroom':
      return <g><path d="M50 48 Q100 -10 150 48 Z" fill={color} /><circle cx="80" cy="28" r="6" fill={color2} /><circle cx="118" cy="24" r="7" fill={color2} /></g>;
    case 'fedora':
      return <g><rect x="66" y="18" width="68" height="34" rx="10" fill={color} /><ellipse cx="100" cy="52" rx="62" ry="9" fill={color} /><rect x="66" y="40" width="68" height="7" fill={color2} /></g>;
    default:
      return null;
  }
}
