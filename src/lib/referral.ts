'use client';

import { api } from './api';
import { deviceId, track } from './analytics';

const PENDING = 'ca_ref';
const SENT = 'ca_ref_sent';
const GIFT = 'ca_ref_gift';

export function referralKey(tokenId: number | null): string {
  return tokenId !== null ? `t${tokenId}` : `d-${deviceId()}`;
}

/** Called on load: remember who invited this device (first touch wins). Returns true if a welcome gift is due. */
export function captureReferral(): boolean {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (!ref) return false;
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState(null, '', url.pathname + url.search);
    if (localStorage.getItem(PENDING) || ref === `d-${deviceId()}`) return false;
    localStorage.setItem(PENDING, ref);
    track('referral_landing');
    if (localStorage.getItem(GIFT)) return false;
    localStorage.setItem(GIFT, '1');
    return true;
  } catch {
    return false;
  }
}

/** Called after a finished match: credits the inviter once per device. */
export function confirmReferral() {
  try {
    const ref = localStorage.getItem(PENDING);
    if (!ref || localStorage.getItem(SENT)) return;
    localStorage.setItem(SENT, '1');
    void api('/api/referral', { json: { ref, device: deviceId() } }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}
