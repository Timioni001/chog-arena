/**
 * Name filter for display names and clan names shown on public boards. It normalises common
 * obfuscation (l33t, spacing, repeats) before matching. It is a first line of defence, not a
 * replacement for reports and the flag list.
 */
/** Unambiguous terms: blocked anywhere in the name, even when run together. */
const BLOCKED = [
  'fuck', 'shit', 'cunt', 'kunt', 'bitch', 'whore', 'slut', 'pussy', 'vagina', 'porn',
  'nigger', 'nigga', 'faggot', 'retard', 'tranny', 'kike', 'chink', 'wetback', 'hitler', 'killyourself', 'molest',
];
/** Real words that contain a blocked term (the Scunthorpe problem). */
const ALLOW = ['scunthorpe', 'shiitake', 'shitake', 'matsushita', 'penistone', 'cocktail', 'hancock', 'peacock'];
/** Short words that hide inside innocent ones (spicy, peacock, grape, torpedo): blocked as whole words only. */
const BLOCKED_WORDS = ['spic', 'fag', 'dick', 'cock', 'rape', 'nazi', 'pedo', 'gook', 'kys', 'penis', 'cum', 'anal'];
/** Names that would impersonate staff or the project. */
const RESERVED_PREFIX = ['admin', 'moderator', 'official', 'chogarena', 'chogteam', 'monadteam', 'monadfoundation'];
const RESERVED_WORDS = ['mod', 'staff', 'support', 'team', 'dev'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'l' };

export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0134578@$!|]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1');
}

export type NameCheck = { ok: true; value: string } | { ok: false; reason: string };

export function checkName(raw: string, opts: { min?: number; max?: number } = {}): NameCheck {
  const value = raw.replace(/\s+/g, ' ').trim();
  const min = opts.min ?? 2, max = opts.max ?? 20;
  if (value.length < min) return { ok: false, reason: `Use at least ${min} characters.` };
  if (value.length > max) return { ok: false, reason: `Keep it to ${max} characters.` };
  if (/[\u0000-\u001f​-‏‪-‮]/.test(value)) return { ok: false, reason: 'That name has hidden characters.' };
  if (/https?:|www\.|\.(com|xyz|io|gg)\b/i.test(value)) return { ok: false, reason: 'Links are not allowed in names.' };
  if (/0x[a-f0-9]{6,}/i.test(value)) return { ok: false, reason: 'Wallet addresses are not allowed in names.' };
  const n = ALLOW.reduce((acc, w) => acc.split(w).join(''), normaliseName(value));
  // Also check common letter swaps (fvck, phuck, kunt).
  const forms = [n, n.replace(/v/g, 'u').replace(/ph/g, 'f'), n.replace(/ph/g, 'f')];
  const words = value.split(/[^\p{L}\p{N}@$!|]+/u).map(normaliseName).filter(Boolean);
  const wordForms = words.flatMap((w) => [w, w.replace(/v/g, 'u').replace(/ph/g, 'f')]);
  if (forms.some((f) => BLOCKED.some((w) => f.includes(w))) || wordForms.some((w) => BLOCKED_WORDS.includes(w))) {
    return { ok: false, reason: 'Please choose a different name.' };
  }
  if (RESERVED_PREFIX.some((w) => n.startsWith(w)) || (words.length > 1 && words.some((w) => RESERVED_WORDS.includes(w))) || RESERVED_WORDS.includes(n)) {
    return { ok: false, reason: 'That name is reserved.' };
  }
  return { ok: true, value };
}
