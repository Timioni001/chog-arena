import type { BotSpecies } from './bots';

const INK = '#170d22';

/** Bot art as a plain SVG string, shared by the in-game sprite and the ERC-1155 image endpoint. */
export function botSvg(species: BotSpecies, opts: { size?: number; level?: number; background?: boolean } = {}): string {
  const { color: c, accent: a, shape } = species;
  const size = opts.size ?? 64;
  let body = '';
  switch (shape) {
    case 'drone':
      body = `<line x1="50" y1="22" x2="50" y2="34"/><ellipse cx="50" cy="20" rx="22" ry="5" fill="${a}"/><circle cx="50" cy="56" r="24" fill="${c}"/><rect x="34" y="48" width="32" height="14" rx="7" fill="#1b1424"/><circle cx="42" cy="55" r="4" fill="${a}" stroke="none"/><circle cx="58" cy="55" r="4" fill="${a}" stroke="none"/><ellipse cx="50" cy="86" rx="16" ry="4" fill="#000" opacity=".2" stroke="none"/>`;
      break;
    case 'mite': {
      const legs = [-1, 1].flatMap((s) => [0, 1, 2].map((i) => `<line x1="${50 + s * 18}" y1="${58 + i * 8}" x2="${50 + s * 34}" y2="${62 + i * 10}"/>`)).join('');
      body = `${legs}<ellipse cx="50" cy="60" rx="24" ry="20" fill="${c}"/><path d="M38 40 Q50 18 62 40" fill="${a}"/><circle cx="42" cy="56" r="5" fill="#fff"/><circle cx="58" cy="56" r="5" fill="#fff"/><circle cx="43" cy="57" r="2" fill="${INK}" stroke="none"/><circle cx="59" cy="57" r="2" fill="${INK}" stroke="none"/>`;
      break;
    }
    case 'orb':
      body = `<circle cx="50" cy="52" r="30" fill="${c}" opacity=".9"/><ellipse cx="40" cy="40" rx="9" ry="6" fill="${a}" stroke="none" opacity=".8"/><path d="M40 60 Q50 68 60 60" fill="none"/><circle cx="40" cy="52" r="3.5" fill="${INK}" stroke="none"/><circle cx="60" cy="52" r="3.5" fill="${INK}" stroke="none"/>`;
      break;
    case 'crab':
      body = `<path d="M18 44 Q10 30 22 26 Q28 34 26 42 Z" fill="${c}"/><path d="M82 44 Q90 30 78 26 Q72 34 74 42 Z" fill="${c}"/><ellipse cx="50" cy="60" rx="30" ry="20" fill="${c}"/><path d="M50 40 Q46 26 56 20 Q58 32 50 40" fill="#5ee36a"/><circle cx="40" cy="56" r="4" fill="${INK}" stroke="none"/><circle cx="60" cy="56" r="4" fill="${INK}" stroke="none"/><ellipse cx="30" cy="64" rx="5" ry="3" fill="${a}" stroke="none"/><ellipse cx="70" cy="64" rx="5" ry="3" fill="${a}" stroke="none"/>`;
      break;
    case 'kite':
      body = `<path d="M50 10 L82 46 L50 88 L18 46 Z" fill="${c}"/><path d="M50 10 L50 88 M18 46 L82 46"/><path d="M50 88 Q40 94 46 98" fill="none" stroke="${a}"/><circle cx="42" cy="40" r="3.5" fill="${INK}" stroke="none"/><circle cx="58" cy="40" r="3.5" fill="${INK}" stroke="none"/><path d="M44 52 L50 58 L56 52" fill="none" stroke="${a}"/>`;
      break;
    case 'golem':
      body = `<rect x="22" y="34" width="56" height="46" rx="12" fill="${c}"/><rect x="32" y="16" width="36" height="26" rx="8" fill="${c}"/><rect x="12" y="44" width="14" height="26" rx="6" fill="${c}"/><rect x="74" y="44" width="14" height="26" rx="6" fill="${c}"/><rect x="38" y="24" width="8" height="6" rx="2" fill="${a}" stroke="none"/><rect x="54" y="24" width="8" height="6" rx="2" fill="${a}" stroke="none"/><path d="M36 52 L50 60 L64 52" fill="none" stroke="${a}"/>`;
      break;
  }
  const bg = opts.background ? `<rect width="100" height="100" rx="22" fill="#f1ebff"/>` : '';
  const lvl = opts.level !== undefined ? `<g><rect x="62" y="78" width="36" height="20" rx="10" fill="#ffd166" stroke="${INK}" stroke-width="3"/><text x="80" y="92" text-anchor="middle" font-size="13" font-weight="900" font-family="system-ui,sans-serif" fill="#2a1a00">L${opts.level}</text></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${species.name}">${bg}<g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${body}</g>${lvl}</svg>`;
}
