import type { ReactNode } from 'react';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <a href="/" className="eyebrow hover:text-ink">← Chog Arena</a>
      <h1 className="mt-4 font-display text-4xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-dim">Last updated {updated}. Template text: have it reviewed by counsel for your jurisdiction before launch.</p>
      <div className="mt-8 space-y-6 leading-relaxed text-ink/90 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-ink/85">{children}</div>
    </main>
  );
}
