import { memo } from 'react';
import type { Appearance } from '@/lib/appearance';

const INK = '#170d22';

function spikes(cx: number, cy: number, rOut: number, rIn: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Flat 2D portrait of a Chog built from the same Appearance as the 3D model. */
export const ChogSprite = memo(function ChogSprite({ look, size = 96, background = true, className }: { look: Appearance; size?: number; background?: boolean; className?: string }) {
  const { eyes, mouth, head, body } = look;
  const id = `g${Math.abs(hash(JSON.stringify(look))) % 1e9}`;
  const quill = look.skull ? '#efe7d2' : look.skinShade;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label="Chog portrait">
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={look.bg[0]} />
          <stop offset="100%" stopColor={look.bg[1]} />
        </radialGradient>
        {look.aura && (
          <filter id={`${id}glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={look.aura.color} floodOpacity="0.9" />
          </filter>
        )}
      </defs>
      {background && <rect width="200" height="200" rx="40" fill={`url(#${id}bg)`} />}
      <g filter={look.aura ? `url(#${id}glow)` : undefined} stroke={INK} strokeWidth="4" strokeLinejoin="round">
        {/* body */}
        <ellipse cx="100" cy="182" rx="50" ry="36" fill={body.kind === 'none' ? look.skin : body.color} />
        {body.kind === 'suit' && <path d="M88 150 L100 170 L112 150 Z" fill="#ffffff" />}
        {body.kind === 'jersey' && <text x="100" y="186" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fff" stroke="none">143</text>}
        {/* quills */}
        <polygon points={spikes(100, 92, 86, 60, 13)} fill={quill} />
        <circle cx="100" cy="92" r="62" fill={look.skin} />
        {/* face */}
        <ellipse cx="100" cy="104" rx="45" ry="40" fill={look.face} strokeWidth="3" />
      </g>
      {/* eyes */}
      <g>
        {renderEyes(eyes.kind, eyes.color, look.skull)}
      </g>
      {!look.skull && (
        <g>
          <ellipse cx="68" cy="114" rx="9" ry="6" fill={look.cheeks} />
          <ellipse cx="132" cy="114" rx="9" ry="6" fill={look.cheeks} />
          <ellipse cx="100" cy="109" rx="5" ry="3.5" fill="#ff9cc8" />
        </g>
      )}
      {look.skull && <path d="M96 112 L104 112 L100 118 Z" fill="#2a1d33" />}
      <g transform="translate(100 124)">{renderMouth(mouth.kind, mouth.color)}</g>
      <g stroke={INK} strokeWidth="4" strokeLinejoin="round">{renderHead(head.kind, head.color, head.color2, head.text)}</g>
    </svg>
  );
});

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function renderEyes(kind: Appearance['eyes']['kind'], color: string, skull: boolean) {
  const L = 84, R = 116, Y = 98;
  const base = skull ? '#2a1d33' : '#1b1424';
  switch (kind) {
    case 'happy':
      return <g fill="none" stroke="#1b1424" strokeWidth="4" strokeLinecap="round">{[L, R].map((x) => <path key={x} d={`M${x - 8} ${Y + 3} Q${x} ${Y - 9} ${x + 8} ${Y + 3}`} />)}</g>;
    case 'closed':
      return <g stroke={color} strokeWidth="4" strokeLinecap="round">{[L, R].map((x) => <line key={x} x1={x - 8} y1={Y} x2={x + 8} y2={Y} />)}</g>;
    case 'dead':
      return <g stroke="#1b1424" strokeWidth="4" strokeLinecap="round">{[L, R].map((x) => <g key={x}><line x1={x - 7} y1={Y - 7} x2={x + 7} y2={Y + 7} /><line x1={x + 7} y1={Y - 7} x2={x - 7} y2={Y + 7} /></g>)}</g>;
    case 'heart':
      return <g fill={color}>{[L, R].map((x) => <path key={x} d={`M${x} ${Y + 8} C${x - 14} ${Y - 2} ${x - 6} ${Y - 12} ${x} ${Y - 4} C${x + 6} ${Y - 12} ${x + 14} ${Y - 2} ${x} ${Y + 8} Z`} />)}</g>;
    case 'visor':
      return <rect x="62" y="88" width="76" height="20" rx="10" fill={color} stroke="#170d22" strokeWidth="3" />;
    case 'vr':
      return <rect x="60" y="84" width="80" height="28" rx="8" fill={color} stroke="#170d22" strokeWidth="3" />;
    case 'shades':
      return <g fill={color} stroke="#170d22" strokeWidth="3"><rect x="68" y="90" width="28" height="18" rx="5" /><rect x="104" y="90" width="28" height="18" rx="5" /><line x1="96" y1="96" x2="104" y2="96" /></g>;
    case 'laser':
      return <g>{[L, R].map((x) => <g key={x}><circle cx={x} cy={Y} r="9" fill={color} opacity="0.5" /><circle cx={x} cy={Y} r="5" fill="#fff" /></g>)}</g>;
    case 'frog':
      return <g>{[L - 2, R + 2].map((x) => <g key={x}><circle cx={x} cy={Y - 4} r="11" fill="#fff" stroke="#170d22" strokeWidth="3" /><circle cx={x} cy={Y - 3} r="5" fill="#1b1424" /></g>)}</g>;
    default: {
      const dx = kind === 'side' ? 3 : 0;
      const dy = kind === 'up' ? -3 : 0;
      return (
        <g>
          {[L, R].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy={Y} rx="7" ry={kind === 'tired' ? 6 : 10} fill={base} />
              {color !== '#1b1424' && <circle cx={x + dx} cy={Y + dy} r="3.5" fill={color} />}
              <circle cx={x + 2.5 + dx} cy={Y - 4 + dy} r="2.5" fill="#fff" />
              {kind === 'tired' && <rect x={x - 9} y={Y - 10} width="18" height="7" fill="#fff1d6" />}
              {kind === 'angry' && <line x1={x - 9} y1={Y - 15 + (x < 100 ? -3 : 3)} x2={x + 9} y2={Y - 15 + (x < 100 ? 3 : -3)} stroke="#1b1424" strokeWidth="4" strokeLinecap="round" />}
              {kind === 'cry' && <ellipse cx={x + 6} cy={Y + 16} rx="3" ry="5" fill="#7fd7ff" />}
            </g>
          ))}
        </g>
      );
    }
  }
}

function renderMouth(kind: Appearance['mouth']['kind'], color: string) {
  const ink = '#5a1830';
  switch (kind) {
    case 'sad':
      return <path d="M-9 4 Q0 -5 9 4" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />;
    case 'flat':
      return <line x1="-8" y1="0" x2="8" y2="0" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />;
    case 'o':
      return <circle r="4.5" fill="none" stroke={ink} strokeWidth="3" />;
    case 'grit':
      return <rect x="-10" y="-4" width="20" height="8" rx="2" fill="#fff" stroke={ink} strokeWidth="2.5" />;
    case 'gum':
      return <g><path d="M-8 -2 Q0 6 8 -2" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" /><circle cx="8" cy="6" r="9" fill={color} stroke="#170d22" strokeWidth="2.5" /></g>;
    case 'coin':
      return <circle cx="0" cy="3" r="8" fill={color} stroke="#170d22" strokeWidth="2.5" />;
    case 'puke':
      return <g>{['#ff5a5a', '#ffb347', '#ffe14d', '#5ee36a', '#4ee6f0', '#7c4dff'].map((c, i) => <rect key={c} x={-8 + i * 2.7} y="0" width="3" height={14 + (i % 2) * 6} fill={c} />)}</g>;
    case 'clown':
      return <path d="M-14 -2 Q0 12 14 -2" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />;
    case 'grin':
      return <g><path d="M-9 -2 Q0 7 9 -2" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" /><rect x="1" y="1" width="5" height="5" fill={color} /></g>;
    case 'drool':
      return <g><path d="M-8 -2 Q0 6 8 -2" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" /><ellipse cx="6" cy="8" rx="2.5" ry="4.5" fill={color} /></g>;
    default:
      return <path d="M-8 -2 Q0 6 8 -2" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />;
  }
}

function renderHead(kind: Appearance['head']['kind'], color: string, color2: string, text: string | null) {
  switch (kind) {
    case 'cap':
    case 'bucket':
      return (
        <g>
          <path d="M44 66 Q100 4 156 66 Z" fill={color} />
          <path d={kind === 'bucket' ? 'M30 70 L170 70 L160 60 L40 60 Z' : 'M70 64 Q100 56 150 70 L160 76 Q110 68 70 72 Z'} fill={kind === 'bucket' ? color2 : color} />
          {text && <text x="100" y="54" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff" stroke="none">{text}</text>}
        </g>
      );
    case 'beanie':
      return <g><path d="M42 66 Q100 -6 158 66 Z" fill={color} /><rect x="40" y="58" width="120" height="14" rx="7" fill="#f4f1ea" /><circle cx="100" cy="18" r="10" fill="#f4f1ea" /></g>;
    case 'crown':
      return <path d="M62 44 L72 14 L86 36 L100 8 L114 36 L128 14 L138 44 Z" fill={color} />;
    case 'wizard':
      return <g><path d="M60 46 L112 -10 L140 46 Z" fill={color} /><ellipse cx="100" cy="48" rx="62" ry="10" fill={color} /></g>;
    case 'helmet':
      return <g><path d="M38 70 Q100 -2 162 70 Z" fill={color} /><rect x="94" y="0" width="12" height="40" fill={color2} /></g>;
    case 'horns':
      return <g><path d="M52 40 L40 6 L66 32 Z" fill={color} /><path d="M148 40 L160 6 L134 32 Z" fill={color} /></g>;
    case 'halo':
    case 'gem':
      return kind === 'halo' ? <ellipse cx="100" cy="14" rx="34" ry="8" fill="none" stroke={color} strokeWidth="6" /> : <path d="M100 0 L114 14 L100 30 L86 14 Z" fill={color} />;
    case 'headband':
      return <rect x="40" y="62" width="120" height="12" rx="6" fill={color} />;
    case 'durag':
      return <path d="M40 72 Q100 6 160 72 Z" fill={color} />;
    case 'hair':
      return <g>{[50, 72, 100, 128, 150].map((x, i) => <circle key={x} cx={x} cy={46 - (i === 2 ? 14 : 0)} r="24" fill={text === 'rainbow' ? ['#ff5a5a', '#ffe14d', '#5ee36a', '#4ee6f0', '#ff5fd2'][i] : color} />)}</g>;
    case 'ushanka':
      return <g><rect x="46" y="24" width="108" height="40" rx="14" fill={color} /><rect x="40" y="56" width="120" height="14" rx="6" fill={color2} /></g>;
    case 'clownNose':
      return <circle cx="100" cy="109" r="9" fill={color} />;
    case 'mask':
      return <rect x="58" y="88" width="84" height="20" rx="10" fill={color} opacity="0.9" />;
    case 'thirdEye':
      return <ellipse cx="100" cy="72" rx="6" ry="9" fill={color} />;
    case 'shroom':
      return <g><path d="M48 50 Q100 -10 152 50 Z" fill={color} /><circle cx="80" cy="30" r="6" fill={color2} stroke="none" /><circle cx="118" cy="26" r="7" fill={color2} stroke="none" /></g>;
    case 'fedora':
      return <g><rect x="64" y="20" width="72" height="36" rx="10" fill={color} /><ellipse cx="100" cy="56" rx="64" ry="10" fill={color} /><rect x="64" y="42" width="72" height="8" fill={color2} /></g>;
    default:
      return null;
  }
}
