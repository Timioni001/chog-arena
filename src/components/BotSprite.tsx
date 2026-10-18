import { memo } from 'react';
import type { BotSpecies } from '@/game/bots';
import { botSvg } from '@/game/botSvg';

/** Original companion bot art, drawn per species shape. */
export const BotSprite = memo(function BotSprite({ species, size = 64, level }: { species: BotSpecies; size?: number; level?: number }) {
  return <span className="inline-block leading-none" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: botSvg(species, { size, level }) }} />;
});
