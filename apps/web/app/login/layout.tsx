import type { ReactNode } from 'react';
import { AdminProviders } from '../../components/admin-providers';

// Mantine is scoped to the admin surfaces (see components/admin-providers).
// The sign-in screen is one of them.
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AdminProviders>{children}</AdminProviders>;
}
