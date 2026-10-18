import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Privacy · Chog Arena' };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="October 2026">
      <section>
        <h2>What we store</h2>
        <ul>
          <li><b>Wallet address</b>, when you connect and sign in, to check which Chogs you hold. Leaderboards show it unless you turn on “Hide my wallet”.</li>
          <li><b>Game data per Chog token</b>: level, Sparks, bots, quests, match results, MMR, clan, and the display name you choose.</li>
          <li><b>An anonymous device id</b> in your browser’s storage, used for invite credit and daily, anonymous usage counts (sessions, matches, D1/D7 return rates). No names, emails or IP addresses are stored with it.</li>
          <li><b>A sign-in cookie</b> that keeps you signed in for 7 days. No advertising or third-party tracking cookies.</li>
        </ul>
      </section>
      <section>
        <h2>Where it lives</h2>
        <p>The app runs on Cloudflare; game data is stored in Upstash Redis. Your gameplay on the blockchain (shop purchases, prize claims, recorded results) is public by nature and cannot be deleted.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Play the demo without connecting a wallet.</li>
          <li>Hide your wallet on leaderboards in Profile.</li>
          <li>Clear your browser storage to reset the device id and local progress.</li>
          <li>Ask us to delete offchain data tied to a token you hold via the Chog Discord.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
