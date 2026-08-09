'use client';

import {
  ActionIcon,
  AppShell,
  Avatar,
  Box,
  Divider,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Select,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconChevronDown,
  IconCube,
  IconDatabase,
  IconExternalLink,
  IconFileText,
  IconFiles,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconPalette,
  IconSettings,
  IconShieldLock,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { BoltMark, NerivaLogo } from '../../components/logo';
import { ApiError, logout, me, type PublicUser } from '../../lib/api';
import { clearTokens, getRefreshToken } from '../../lib/auth-storage';
import { publicPageUrl, SiteProvider, useSite } from '../../lib/site-context';

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

const RAIL_WIDTH = 64;
const MIN_WIDTH = 200;
const MAX_WIDTH = 380;
const WIDTH_KEY = 'neriva.navWidth';
const COLLAPSED_KEY = 'neriva.navCollapsed';

function SiteSwitcher({ collapsed }: { collapsed: boolean }) {
  const { sites, current, select } = useSite();
  if (sites.length === 0) {
    return null;
  }
  if (collapsed) {
    return (
      <Tooltip
        label={current ? `Working on: ${current.name}` : 'No site selected'}
        position="right"
      >
        <Box ta="center" py={4}>
          <IconWorld size={17} stroke={1.7} color="var(--mantine-color-slate-4)" />
        </Box>
      </Tooltip>
    );
  }
  return (
    <Group gap={6} wrap="nowrap" mt="sm">
      <Select
        size="xs"
        flex={1}
        data={sites.map((s) => ({ value: s.id, label: s.name }))}
        value={current?.id ?? null}
        onChange={select}
        allowDeselect={false}
        leftSection={<IconWorld size={14} />}
        comboboxProps={{ withinPortal: true }}
        aria-label="Current site"
      />
      <Tooltip label="Open the published site in a new tab">
        <ActionIcon
          component="a"
          href={current ? publicPageUrl(current.slug, '/') : '#'}
          target="_blank"
          variant="subtle"
          color="slate.5"
          disabled={!current}
          aria-label="Visit site"
        >
          <IconExternalLink size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function Shell({ user, children }: { user: PublicUser; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(248);
  const dragging = useRef(false);

  useEffect(() => {
    const storedWidth = Number(localStorage.getItem(WIDTH_KEY));
    if (storedWidth >= MIN_WIDTH && storedWidth <= MAX_WIDTH) {
      setWidth(storedWidth);
    }
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === 'true');
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      localStorage.setItem(COLLAPSED_KEY, String(!value));
      return !value;
    });
  }, []);

  const startResize = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    dragging.current = true;
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) {
        return;
      }
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(next);
    };
    const onUp = (e: MouseEvent) => {
      dragging.current = false;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      localStorage.setItem(WIDTH_KEY, String(next));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  async function onLogout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await logout(refreshToken).catch(() => undefined);
    }
    clearTokens();
    router.replace('/login');
  }

  const initials = user.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const navWidth = collapsed ? RAIL_WIDTH : width;

  return (
    <AppShell navbar={{ width: navWidth, breakpoint: 0 }} padding="xl" bg="slate.0">
      <AppShell.Navbar p={collapsed ? 'xs' : 'md'} bg="white" style={{ overflow: 'visible' }}>
        {!collapsed ? (
          <Box
            onMouseDown={startResize}
            title="Drag to resize"
            style={{
              position: 'absolute',
              top: 0,
              right: -3,
              width: 6,
              height: '100%',
              cursor: 'col-resize',
              zIndex: 10,
            }}
          />
        ) : null}

        <AppShell.Section>
          <Group justify={collapsed ? 'center' : 'space-between'} px={collapsed ? 0 : 'xs'} py={6}>
            <Link href="/admin" aria-label="Neriva home">
              {collapsed ? (
                <BoltMark size={24} />
              ) : (
                <NerivaLogo size={26} textColor="var(--mantine-color-slate-9)" />
              )}
            </Link>
            {!collapsed ? (
              <Tooltip label="Collapse the menu">
                <ActionIcon variant="subtle" color="slate.4" onClick={toggleCollapsed}>
                  <IconLayoutSidebarLeftCollapse size={17} />
                </ActionIcon>
              </Tooltip>
            ) : null}
          </Group>
          {collapsed ? (
            <Tooltip label="Expand the menu" position="right">
              <ActionIcon
                variant="subtle"
                color="slate.4"
                onClick={toggleCollapsed}
                w="100%"
                mt={4}
              >
                <IconLayoutSidebarLeftExpand size={17} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          <SiteSwitcher collapsed={collapsed} />
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} mt="md">
          {NAV_GROUPS.map((group) => (
            <Box key={group.label} mb="md">
              {!collapsed ? (
                <Text size="xs" fw={700} tt="uppercase" c="slate.4" px="xs" mb={4} lts="0.06em">
                  {group.label}
                </Text>
              ) : null}
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                if (collapsed) {
                  return (
                    <Tooltip key={item.href} label={item.label} position="right">
                      <ActionIcon
                        component={Link}
                        href={item.href}
                        variant={active ? 'light' : 'subtle'}
                        color={active ? 'neriva' : 'slate.5'}
                        size="lg"
                        w="100%"
                        mb={4}
                        aria-label={item.label}
                      >
                        <item.icon size={18} stroke={1.7} />
                      </ActionIcon>
                    </Tooltip>
                  );
                }
                return (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    title={item.help}
                    leftSection={<item.icon size={17} stroke={1.7} />}
                    active={active}
                    variant="light"
                    style={{ borderRadius: 8 }}
                  />
                );
              })}
            </Box>
          ))}
        </AppShell.Section>

        <AppShell.Section>
          <Divider mb="sm" color="slate.1" />
          <Menu position="top-start" width={220} shadow="md">
            <Menu.Target>
              <UnstyledButton w="100%" p={collapsed ? 4 : 'xs'} style={{ borderRadius: 8 }}>
                <Group gap="sm" wrap="nowrap" justify={collapsed ? 'center' : 'flex-start'}>
                  <Avatar color="neriva" radius="xl" size={collapsed ? 28 : 32}>
                    {initials}
                  </Avatar>
                  {!collapsed ? (
                    <>
                      <Box flex={1} miw={0}>
                        <Text size="sm" fw={600} truncate>
                          {user.displayName}
                        </Text>
                        <Text size="xs" c="slate.4" truncate>
                          {user.email}
                        </Text>
                      </Box>
                      <IconChevronDown size={14} color="var(--mantine-color-slate-4)" />
                    </>
                  ) : null}
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

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
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

  if (!user) {
    return null;
  }

  return (
    <SiteProvider>
      <Shell user={user}>{children}</Shell>
    </SiteProvider>
  );
}
