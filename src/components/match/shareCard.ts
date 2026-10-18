'use client';

/** Renders a 1080×1350 result card to PNG using only canvas (no external images). */
export async function makeShareCard(o: {
  won: boolean;
  draw: boolean;
  name: string;
  opponent: string;
  score: number;
  lanes: (0 | 1 | null)[];
  power: [number, number];
  mode: string;
  svg: SVGSVGElement | null;
  url: string | null;
}): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const css = getComputedStyle(document.documentElement);
  const serif = `${css.getPropertyValue('--font-fraunces').trim() || 'Georgia'}, Georgia, serif`;
  const sans = `${css.getPropertyValue('--font-manrope').trim() || 'system-ui'}, system-ui, sans-serif`;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, o.won ? '#6d3ad6' : o.draw ? '#3a2a6a' : '#4a1a3a');
  g.addColorStop(1, '#120b24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x < W; x += 36) for (let y = 0; y < H; y += 36) ctx.fillRect(x, y, 3, 3);

  ctx.textAlign = 'center';
  ctx.fillStyle = o.won ? '#ffc861' : o.draw ? '#ffffff' : '#ff8fa8';
  ctx.font = `italic 600 130px ${serif}`;
  ctx.fillText(o.won ? 'Victory' : o.draw ? 'Draw' : 'Defeat', W / 2, 190);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `600 36px ${sans}`;
  ctx.fillText(`${o.mode.toUpperCase()} · vs ${o.opponent}`.slice(0, 48), W / 2, 260);

  if (o.svg) {
    const xml = new XMLSerializer().serializeToString(o.svg);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(W / 2 - 260, 320, 520, 520, 80);
    ctx.clip();
    ctx.drawImage(img, W / 2 - 260, 320, 520, 520);
    ctx.restore();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 66px ${serif}`;
  ctx.fillText(o.name.slice(0, 28), W / 2, 930);
  ctx.font = `600 40px ${sans}`;
  ctx.fillStyle = '#c8b6ff';
  ctx.fillText(`${o.score} pts · ${o.power[0]}–${o.power[1]} power`, W / 2, 995);

  o.lanes.forEach((w, i) => {
    const x = W / 2 - 240 + i * 240;
    ctx.fillStyle = w === 0 ? '#39ff6a' : w === 1 ? '#ff5a6e' : '#888';
    ctx.beginPath();
    ctx.roundRect(x - 90, 1040, 180, 90, 28);
    ctx.fill();
    ctx.fillStyle = '#0d0a18';
    ctx.font = `700 36px ${sans}`;
    ctx.fillText(w === 0 ? 'WON' : w === 1 ? 'LOST' : 'TIE', x, 1100);
  });

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 34px ${sans}`;
  ctx.fillText(o.url ? 'Beat my score: tap the link' : 'CHOG ARENA', W / 2, 1230);
  ctx.fillStyle = '#a98bff';
  ctx.font = `600 48px ${serif}`;
  ctx.fillText('Chog Arena', W / 2, 1300);

  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}
