import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Arena console', robots: { index: false, follow: false, nocache: true } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
