import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Terms · Chog Arena' };

export default function Terms() {
  return (
    <LegalPage title="Terms of Use" updated="October 2026">
      <section>
        <h2>The game</h2>
        <p>Chog Arena is a game. Sparks, energy, bots, levels, cosmetics and rankings are in-game items with no cash value. They can be changed, rebalanced or reset to keep the game fair.</p>
      </section>
      <section>
        <h2>Your Chog</h2>
        <p>Chog Genesis NFTs are issued by a third party. We read ownership from the Monad blockchain and never take custody of your NFT. In-game progress is attached to the token id, so it transfers with the NFT when it is sold. The 3D character and art in the game are our own and are not a license to the NFT artwork.</p>
      </section>
      <section>
        <h2>$CHOG and onchain features</h2>
        <ul>
          <li>$CHOG is a third-party token. Nothing in the game is investment advice or an offer of returns.</li>
          <li>Season prizes are paid only from the prize vault funded by shop purchases. There are no paid random draws.</li>
          <li>Smart contracts are unaudited and run with spending and claim caps. Blockchain transactions are final; you pay network fees.</li>
          <li>Onchain features (shop, prizes, recording results) are for players aged 18+ and only where lawful in your jurisdiction.</li>
        </ul>
      </section>
      <section>
        <h2>Fair play</h2>
        <p>No bots, scripts, exploits, multi-accounting to farm rewards, or buying a Chog just to flip ranked rewards (a 24-hour lock applies after transfers). Flagged Chogs are listed publicly with the reason and may appeal in the Chog Discord.</p>
      </section>
      <section>
        <h2>Names and conduct</h2>
        <p>Display and clan names must not be offensive, impersonate others, or contain links. We may rename or remove them.</p>
      </section>
      <section>
        <h2>Liability</h2>
        <p>The game is provided as is, without warranties. To the extent the law allows, we are not liable for lost items, network failures, wallet errors or token price changes.</p>
      </section>
    </LegalPage>
  );
}
