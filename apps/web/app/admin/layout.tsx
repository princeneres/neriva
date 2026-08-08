'use client';

import {
  AppShell,
  Avatar,
  Box,
  Divider,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Text,
  UnstyledButton,
} from '@mantine/core';
import {
  IconChevronDown,
  IconCube,
  IconDatabase,
  IconFileText,
  IconFiles,
  IconLogout,
  IconPalette,
  IconSettings,
  IconShieldLock,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { NerivaLogo } from '../../components/logo';
import { ApiError, logout, me, type PublicUser } from '../../lib/api';
import { clearTokens, getRefreshToken } from '../../lib/auth-storage';

const NAV_GROUPS: {
  label: string;
  items: { label: string; href: string; icon: typeof IconWorld; help: string }[];
}[] = [
  {
    label: 'Content',
    items: [
      {
        label: 'Sites',
        href: '/admin/sites',
        icon: IconWorld,
        help: 'A site groups pages and content under one address',
      },
      {
        label: 'Pages',
        href: '/admin/pages',
        icon: IconFiles,
        help: 'Pages are built by stacking blocks',
      },
      {
        label: 'Content',
        href: '/admin/content',
        icon: IconFileText,
        help: 'Structured content: define a type, then write entries',
      },
      {
        label: 'Objects',
        href: '/admin/objects',
        icon: IconDatabase,
        help: 'Your own data tables, defined without code',
      },
    ],
  },
  {
    label: 'Design',
    items: [
      {
        label: 'Blocks',
        href: '/admin/blocks',
        icon: IconCube,
        help: 'Reusable building pieces that pages are made of',
      },
      {
        label: 'Style Book',
        href: '/admin/style-book',
        icon: IconPalette,
        help: 'Colors, spacing and typography, in one place',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Users',
        href: '/admin/users',
        icon: IconUsers,
        help: 'People who can sign in to this admin',
      },
      {
        label: 'Roles',
        href: '/admin/roles',
        icon: IconShieldLock,
        help: 'What each kind of user is allowed to do',
      },
      {
        label: 'Settings',
        href: '/admin/settings',
        icon: IconSettings,
        help: 'System configuration such as SMTP and site metadata',
      },
    ],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    me()
      .then(({ data }) => setUser(data))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.problem.code === 'MUST_CHANGE_PASSWORD') {
          router.replace('/change-password');
          return;
        }
        clearTokens();
        router.replace('/login');
      });
  }, [router]);

  async function onLogout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await logout(refreshToken).catch(() => undefined);
    }
    clearTokens();
    router.replace('/login');
  }

  if (!user) {
    return null;
  }

  const initials = user.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <AppShell navbar={{ width: 248, breakpoint: 'sm' }} padding="xl" bg="slate.0">
      <AppShell.Navbar p="md" bg="white">
        <AppShell.Section>
          <Group justify="space-between" px="xs" py={6}>
            <Link href="/admin" aria-label="Neriva home">
              <NerivaLogo size={26} textColor="var(--mantine-color-slate-9)" />
            </Link>
          </Group>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} mt="md">
          {NAV_GROUPS.map((group) => (
            <Box key={group.label} mb="md">
              <Text size="xs" fw={700} tt="uppercase" c="slate.4" px="xs" mb={4} lts="0.06em">
                {group.label}
              </Text>
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  title={item.help}
                  leftSection={<item.icon size={17} stroke={1.7} />}
                  active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                  variant="light"
                  style={{ borderRadius: 8 }}
                />
              ))}
            </Box>
          ))}
        </AppShell.Section>

        <AppShell.Section>
          <Divider mb="sm" color="slate.1" />
          <Menu position="top-start" width={220} shadow="md">
            <Menu.Target>
              <UnstyledButton w="100%" p="xs" style={{ borderRadius: 8 }}>
                <Group gap="sm" wrap="nowrap">
                  <Avatar color="neriva" radius="xl" size={32}>
                    {initials}
                  </Avatar>
                  <Box flex={1} miw={0}>
                    <Text size="sm" fw={600} truncate>
                      {user.displayName}
                    </Text>
                    <Text size="xs" c="slate.4" truncate>
                      {user.email}
                    </Text>
                  </Box>
                  <IconChevronDown size={14} color="var(--mantine-color-slate-4)" />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Signed in as {user.email}</Menu.Label>
              <Menu.Item
                leftSection={<IconLogout size={15} />}
                color="red"
                onClick={() => void onLogout()}
              >
                Sign out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
