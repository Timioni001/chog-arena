import { hasAdminCookie } from '@/server/admin';
import { AdminConsole } from '@/components/admin/Console';
import { AdminLogin } from '@/components/admin/Login';

export const dynamic = 'force-dynamic';

/** Owner console. The page only decides which view to show; every byte of data comes from admin-gated APIs. */
export default async function AdminPage() {
  return (await hasAdminCookie()) ? <AdminConsole /> : <AdminLogin />;
}
