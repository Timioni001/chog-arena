import { describe, expect, it } from 'vitest';
import { checkName } from '../moderation';
import { boostRefill, boostTurbo, boostsLeft, claimClanChest, claimReferral, newProgress, applyTap } from '../progress';
import { BOT_SPECIES } from '../bots';
import { botSvg } from '../botSvg';

const rules = { cap: 500, regenPerSec: 1, tapPower: 2, critChance: 0 };

describe('name moderation', () => {
  it('accepts normal names', () => {
    expect(checkName('Quill Queen').ok).toBe(true);
    for (const good of ['Spiky 143', 'Spicy Chog', 'Peacock', 'Grape Juice', 'Modern Quill', 'Torpedo', 'Scunthorpe Spikes', 'Dickens']) expect(checkName(good).ok, good).toBe(true);
  });
  it('rejects slurs, obfuscation, impersonation, links and addresses', () => {
    for (const bad of ['f u c k', 'Fvck', 'sh1t', 'ADMIN', 'Official Chog', 'Chog Mod', 'chog.xyz', '0xc96d31F8626c6D', 'x', 'big dick', 'n1gg3r', 'f4ck face', 'fck it', 'Phuk']) expect(checkName(bad).ok, bad).toBe(false);
  });
});

describe('boosts', () => {
  it('refills energy up to 3 times a day', () => {
    const now = Date.UTC(2026, 9, 18, 12);
    let p = { ...newProgress(now), energy: 10, energyAt: now };
    for (let i = 0; i < 3; i++) {
      p = boostRefill({ ...p, energy: 10, energyAt: now }, rules, now)!;
      expect(p.energy).toBe(500);
    }
    expect(boostRefill({ ...p, energy: 10, energyAt: now }, rules, now)).toBeNull();
    expect(boostsLeft(p, now + 86_400_000).refill).toBe(3);
  });
  it('turbo is limited and multiplies taps', () => {
    const now = Date.now();
    let p = newProgress(now);
    for (let i = 0; i < 3; i++) p = boostTurbo(p, now)!;
    expect(boostTurbo(p, now)).toBeNull();
    expect(applyTap(newProgress(now), rules, 0, 3, 0.9, now).gained).toBe(6);
  });
});

describe('energy overflow', () => {
  it('keeps gifted energy above the cap', async () => {
    const { currentEnergy } = await import('../progress');
    const now = Date.now();
    expect(currentEnergy({ ...newProgress(now), energy: 800, energyAt: now - 60_000 }, rules, now)).toBe(800);
  });
});

describe('referrals and clan chest', () => {
  it('pays referral tiers once, energy and cosmetics only', () => {
    const p = newProgress();
    const a = claimReferral(p, 3, 3)!;
    expect(a.energy).toBe(p.energy + 1000);
    expect(a.sparks).toBe(p.sparks);
    expect(a.cosmetics).toContain('frame-friend');
    expect(claimReferral(a, 3, 5)).toBeNull();
    expect(claimReferral(p, 10, 4)).toBeNull();
  });
  it('opens clan chest milestones once per season', () => {
    const p = newProgress();
    const a = claimClanChest(p, 1, 5000, 6000)!;
    expect(a.sparks).toBe(p.sparks + 2500);
    expect(claimClanChest(a, 1, 5000, 9000)).toBeNull();
    expect(claimClanChest(p, 1, 20_000, 6000)).toBeNull();
    expect(claimClanChest(a, 2, 5000, 6000)).not.toBeNull();
  });
});

describe('bot art', () => {
  it('renders an SVG for every species', () => {
    for (const s of BOT_SPECIES) expect(botSvg(s, { size: 512 })).toMatch(/^<svg[^>]+viewBox="0 0 100 100"/);
  });
});
