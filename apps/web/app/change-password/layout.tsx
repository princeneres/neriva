import type { ReactNode } from 'react';
import { AdminProviders } from '../../components/admin-providers';

// Mantine is scoped to the admin surfaces (see components/admin-providers).
export default function ChangePasswordLayout({ children }: { children: ReactNode }) {
  return <AdminProviders>{children}</AdminProviders>;
}
