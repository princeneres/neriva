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
  Skeleton,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconChevronDown,
  IconCheck,
  IconCube,
  IconDatabase,
  IconEdit,
  IconExternalLink,
  IconFileText,
  IconFiles,
  IconHome2,
  IconLayoutBoard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconListTree,
  IconLogout,
  IconMapPin,
  IconPalette,
  IconPhoto,
  IconSettings,
  IconShieldLock,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { SitePageTree } from '../app/admin/pages/site-page-tree';
import { logout, type PublicUser } from '../lib/api';
import { clearTokens, getRefreshToken } from '../lib/auth-storage';
import { SiteProvider, useSite, visitSiteUrl } from '../lib/site-context';
import { BoltMark, NerivaLogo } from './logo';
import classes from './admin-shell.module.css';

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
      {
        label: 'Media',
        href: '/admin/media',
        icon: IconPhoto,
        help: 'Images and documents, organized in folders',
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
      {
        label: 'Page Templates',
        href: '/admin/page-templates',
        icon: IconLayoutBoard,
        help: 'Master pages (shared header and footer) and starting points for new pages',
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
// Below this the expanded navbar eats a quarter of the window and screens
// start losing content, so the rail takes over until there is room again.
const AUTO_COLLAPSE_QUERY = '(max-width: 1024px)';

function SiteSwitcher({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const { sites, current, select, defaultSlug } = useSite();
  if (sites.length === 0) {
    return null;
  }
  if (collapsed) {
    return (
      <Menu shadow="md" width={260} position="right-start" withinPortal>
        <Menu.Target>
          <Tooltip label={current ? `Working on: ${current.name}` : 'Choose site'} position="right">
            <UnstyledButton className={classes.siteSwitcherRail} aria-label="Choose current site">
              <IconMapPin size={17} stroke={1.7} />
            </UnstyledButton>
          </Tooltip>
        </Menu.Target>
        <SiteMenuContent
          sites={sites}
          currentId={current?.id}
          defaultSlug={defaultSlug}
          onSelect={(id) => {
            select(id);
            router.refresh();
          }}
        />
      </Menu>
    );
  }
  return (
    <Menu shadow="md" width={280} position="bottom-start" withinPortal>
      <Menu.Target>
        <UnstyledButton className={classes.siteContextButton} aria-label="Choose current site">
          <IconMapPin size={15} />
          <span className={classes.siteContextCopy}>
            <Text size="xs" fw={650} truncate>
              {current?.name ?? 'Choose a site'}
            </Text>
            <Text size="xs" className={classes.siteContextSlug} truncate>
              {current ? `/${current.slug}` : 'No site context'}
            </Text>
          </span>
          <IconChevronDown size={14} />
        </UnstyledButton>
      </Menu.Target>
      <SiteMenuContent
        sites={sites}
        currentId={current?.id}
        defaultSlug={defaultSlug}
        onSelect={(id) => {
          if (id === current?.id) return;
          select(id);
          router.refresh();
        }}
      />
    </Menu>
  );
}

function SiteMenuContent({
  sites,
  currentId,
  defaultSlug,
  onSelect,
}: {
  sites: ReturnType<typeof useSite>['sites'];
  currentId?: string;
  defaultSlug: string | null;
  onSelect: (id: string) => void;
}) {
  const current = sites.find((site) => site.id === currentId);
  return (
    <Menu.Dropdown>
      <Menu.Label>Working site</Menu.Label>
      <ScrollArea.Autosize mah={264} type="auto">
        {sites.map((site) => (
          <Menu.Item
            key={site.id}
            leftSection={<IconMapPin size={15} />}
            rightSection={site.id === currentId ? <IconCheck size={15} /> : undefined}
            onClick={() => onSelect(site.id)}
          >
            <Text size="sm" fw={site.id === currentId ? 650 : 400} lineClamp={1}>
              {site.name}
            </Text>
            <Text size="xs" c="dimmed">
              /{site.slug}
            </Text>
          </Menu.Item>
        ))}
      </ScrollArea.Autosize>
      <Menu.Divider />
      <Menu.Item component={Link} href="/admin/sites" leftSection={<IconSettings size={15} />}>
        Manage sites
      </Menu.Item>
      {current ? (
        <Menu.Item
          component="a"
          href={visitSiteUrl(current.slug, defaultSlug)}
          target="_blank"
          leftSection={<IconExternalLink size={15} />}
        >
          Visit published site
        </Menu.Item>
      ) : null}
    </Menu.Dropdown>
  );
}

export interface AdminShellEditTarget {
  siteSlug: string;
  pagePath: string;
}

export interface AdminShellProps {
  user: PublicUser;
  children: ReactNode;
  /** Present on public site pages: renders a prominent "Edit this page" action. */
  editTarget?: AdminShellEditTarget;
  /** Distinct persisted collapse/width state per surface (admin section vs. a site page). */
  storageNamespace?: 'admin' | 'site';
  /**
   * The signed-in profile is not known yet and `user` is a stand-in. The
   * account row draws a placeholder rather than an empty name and address.
   */
  profilePending?: boolean;
  /** Site pages render their own background (Style Book tokens); the admin section paints one. */
  paintBackground?: boolean;
}

export function AdminShell({
  user,
  children,
  editTarget,
  storageNamespace = 'admin',
  paintBackground = true,
  profilePending = false,
}: AdminShellProps) {
  return (
    <SiteProvider>
      <ShellInner
        user={user}
        editTarget={editTarget}
        storageNamespace={storageNamespace}
        paintBackground={paintBackground}
        profilePending={profilePending}
      >
        {children}
      </ShellInner>
    </SiteProvider>
  );
}

function ShellInner({
  user,
  children,
  editTarget,
  storageNamespace,
  paintBackground,
  profilePending,
}: Required<Pick<AdminShellProps, 'storageNamespace' | 'paintBackground' | 'profilePending'>> &
  Omit<AdminShellProps, 'storageNamespace' | 'paintBackground' | 'profilePending'>) {
  const router = useRouter();
  const pathname = usePathname();
  const { sites } = useSite();
  // Site pages default to a collapsed rail; the admin section defaults open.
  // Keys are namespaced so the two surfaces don't fight over one preference.
  const widthKey = `neriva.navWidth.${storageNamespace}`;
  const collapsedKey = `neriva.navCollapsed.${storageNamespace}`;
  const [collapsedPreference, setCollapsedPreference] = useState(storageNamespace === 'site');
  // Width-driven collapse is an override on top of the saved preference, never
  // a write to it: a narrow window shows the rail, and going back to a wide one
  // restores whatever the user last chose. null means "follow the preference".
  const [viewportOverride, setViewportOverride] = useState<boolean | null>(null);
  // useMediaQuery resolves in an effect, so server and first client render both
  // see undefined. Treating that as "wide" keeps hydration and the first paint
  // in agreement with the markup Next.js sent.
  const narrowViewport = useMediaQuery(AUTO_COLLAPSE_QUERY) ?? false;
  const [width, setWidth] = useState(248);
  const [resolvingEdit, setResolvingEdit] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const dragging = useRef(false);

  useEffect(() => {
    const storedWidth = Number(localStorage.getItem(widthKey));
    if (storedWidth >= MIN_WIDTH && storedWidth <= MAX_WIDTH) {
      setWidth(storedWidth);
    }
    const storedCollapsed = localStorage.getItem(collapsedKey);
    if (storedCollapsed !== null) {
      setCollapsedPreference(storedCollapsed === 'true');
    }
  }, [widthKey, collapsedKey]);

  // Entering a narrow viewport forces the rail; leaving it drops the override
  // so the saved preference applies again.
  useEffect(() => {
    setViewportOverride(narrowViewport ? true : null);
  }, [narrowViewport]);

  const collapsed = viewportOverride ?? collapsedPreference;

  const applyCollapsed = useCallback(
    (next: boolean) => {
      if (narrowViewport) {
        // A manual toggle while narrow wins over the override, but stays out of
        // localStorage: it is about this window size, not a lasting choice.
        setViewportOverride(next);
        return;
      }
      setViewportOverride(null);
      setCollapsedPreference(next);
      localStorage.setItem(collapsedKey, String(next));
    },
    [collapsedKey, narrowViewport],
  );

  const toggleCollapsed = useCallback(() => {
    applyCollapsed(!collapsed);
  }, [applyCollapsed, collapsed]);

  const startResize = useCallback(
    (event: React.MouseEvent) => {
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
        localStorage.setItem(widthKey, String(next));
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [widthKey],
  );

  async function onLogout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await logout(refreshToken).catch(() => undefined);
    }
    clearTokens();
    router.push('/login');
  }

  const openEditor = useCallback(async () => {
    if (!editTarget) {
      return;
    }
    setResolvingEdit(true);
    try {
      const { api } = await import('../lib/api');
      // The site list is already in context: only the page lookup needs the
      // network, so the button resolves in one round trip instead of two.
      const site = sites.find((candidate) => candidate.slug === editTarget.siteSlug);
      if (site !== undefined) {
        const pages = await api.get<{ data: { id: string; path: string }[] }>(
          `/sites/${site.id}/pages?limit=100`,
        );
        const page = pages.data.find((candidate) => candidate.path === editTarget.pagePath);
        if (page !== undefined) {
          router.push(`/admin/pages/${page.id}/design`);
          return;
        }
      }
    } catch {
      // Resolution failed (expired session, API error): fall through.
    }
    router.push('/admin/pages?notfound=1');
  }, [editTarget, router, sites]);

  const initials = user.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const navWidth = collapsed ? RAIL_WIDTH : width;

  return (
    <AppShell
      className={classes.shell}
      navbar={{ width: navWidth, breakpoint: 0 }}
      padding={storageNamespace === 'admin' ? 'xl' : 0}
      // A soft neutral canvas behind white cards: a plain white-on-white
      // main area (the previous mantine-color-body) read as flat and washed
      // out. The navbar has its own dark surface so it reads as a deliberate
      // navigation plane above the tinted content, not part of it.
      bg={paintBackground ? 'var(--mantine-color-slate-0)' : undefined}
    >
      <AppShell.Navbar p={collapsed ? 'xs' : 'md'} style={{ overflow: 'visible', zIndex: 200 }}>
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
          <Group
            className={classes.brandRow}
            justify={collapsed ? 'center' : 'space-between'}
            px={collapsed ? 0 : 'xs'}
            py={6}
          >
            <Link href="/" aria-label="Neriva home">
              {collapsed ? (
                <BoltMark size={24} />
              ) : (
                <NerivaLogo size={26} textColor="var(--admin-nav-text)" />
              )}
            </Link>
            {!collapsed ? (
              <Tooltip label="Collapse the menu">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  className={classes.iconButton}
                  onClick={toggleCollapsed}
                  aria-label="Collapse the menu"
                >
                  <IconLayoutSidebarLeftCollapse size={17} />
                </ActionIcon>
              </Tooltip>
            ) : null}
          </Group>
          {collapsed ? (
            <Tooltip label="Expand the menu" position="right">
              <ActionIcon
                variant="subtle"
                color="gray"
                className={classes.iconButton}
                onClick={toggleCollapsed}
                w="100%"
                mt={4}
                aria-label="Expand the menu"
              >
                <IconLayoutSidebarLeftExpand size={17} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {editTarget ? (
            <Box mt="sm">
              {collapsed ? (
                <>
                  <Tooltip label="Go to the site home" position="right">
                    <ActionIcon
                      component={Link}
                      href={`/s/${editTarget.siteSlug}`}
                      variant="subtle"
                      color="gray"
                      className={classes.iconButton}
                      size="lg"
                      w="100%"
                      mb={4}
                      aria-label="Go to the site home"
                    >
                      <IconHome2 size={18} stroke={1.7} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Page tree" position="right">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      className={classes.iconButton}
                      size="lg"
                      w="100%"
                      mb={4}
                      aria-label="Open the page tree"
                      onClick={() => {
                        applyCollapsed(false);
                        setTreeOpen(true);
                      }}
                    >
                      <IconListTree size={18} stroke={1.7} />
                    </ActionIcon>
                  </Tooltip>
                </>
              ) : (
                <>
                  <NavLink
                    component={Link}
                    href={`/s/${editTarget.siteSlug}`}
                    label="Home"
                    leftSection={<IconHome2 size={17} stroke={1.7} />}
                    className={classes.navLink}
                    style={{ borderRadius: 8 }}
                  />
                  <NavLink
                    label="Page tree"
                    leftSection={<IconListTree size={17} stroke={1.7} />}
                    opened={treeOpen}
                    onClick={() => setTreeOpen((value) => !value)}
                    className={classes.navLink}
                    style={{ borderRadius: 8 }}
                  >
                    <SitePageTree active={treeOpen} siteSlug={editTarget.siteSlug} />
                  </NavLink>
                </>
              )}
            </Box>
          ) : null}
          {editTarget ? (
            <Tooltip
              label="Open this page in the editor"
              position={collapsed ? 'right' : 'top'}
              disabled={!collapsed}
            >
              {collapsed ? (
                <ActionIcon
                  variant="filled"
                  color="neriva"
                  w="100%"
                  mt="sm"
                  onClick={() => void openEditor()}
                  loading={resolvingEdit}
                  aria-label="Edit this page"
                >
                  <IconEdit size={17} />
                </ActionIcon>
              ) : (
                <UnstyledButton
                  onClick={() => void openEditor()}
                  disabled={resolvingEdit}
                  mt="sm"
                  w="100%"
                  py={6}
                  px="xs"
                  className={classes.editButton}
                  style={{
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <IconEdit size={15} />
                  {resolvingEdit ? 'Opening editor…' : 'Edit this page'}
                </UnstyledButton>
              )}
            </Tooltip>
          ) : null}
          <Box className={classes.siteSwitcher}>
            <SiteSwitcher collapsed={collapsed} />
          </Box>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} mt="md">
          {NAV_GROUPS.map((group) => (
            <Box key={group.label} mb="md">
              {!collapsed ? (
                <Text
                  className={classes.navGroupLabel}
                  size="xs"
                  fw={700}
                  tt="uppercase"
                  px="xs"
                  mb={4}
                  lts="0.06em"
                >
                  {group.label}
                </Text>
              ) : null}
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                if (collapsed) {
                  return (
                    <Tooltip key={item.href} label={item.label} position="right">
                      <UnstyledButton
                        component={Link}
                        href={item.href}
                        className={`${classes.collapsedNavItem} ${active ? classes.collapsedNavItemActive : ''}`}
                        aria-label={item.label}
                      >
                        <span className={classes.collapsedNavIcon}>
                          <item.icon size={18} stroke={1.7} />
                        </span>
                      </UnstyledButton>
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
                    className={classes.navLink}
                    style={{ borderRadius: 8 }}
                  />
                );
              })}
            </Box>
          ))}
        </AppShell.Section>

        <AppShell.Section>
          <Divider className={classes.divider} mb="sm" />
          <Menu position="top-start" width={220} shadow="md">
            <Menu.Target>
              <UnstyledButton
                className={classes.accountButton}
                w="100%"
                p={collapsed ? 4 : 'xs'}
                style={{ borderRadius: 8 }}
              >
                <Group gap="sm" wrap="nowrap" justify={collapsed ? 'center' : 'flex-start'}>
                  <Avatar color="neriva" radius="xl" size={collapsed ? 28 : 32}>
                    {profilePending ? null : initials}
                  </Avatar>
                  {!collapsed ? (
                    <>
                      <Box flex={1} miw={0}>
                        {profilePending ? (
                          <>
                            <Skeleton height={9} width="70%" mb={6} />
                            <Skeleton height={8} width="90%" />
                          </>
                        ) : (
                          <>
                            <Text size="sm" fw={600} truncate>
                              {user.displayName}
                            </Text>
                            <Text className={classes.accountEmail} size="xs" truncate>
                              {user.email}
                            </Text>
                          </>
                        )}
                      </Box>
                      <IconChevronDown size={14} color="var(--mantine-color-dimmed)" />
                    </>
                  ) : null}
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>
                {profilePending ? 'Checking your session…' : `Signed in as ${user.email}`}
              </Menu.Label>
              {storageNamespace === 'site' ? (
                <Menu.Item
                  component={Link}
                  href="/admin/pages"
                  leftSection={<IconWorld size={15} />}
                >
                  Go to admin
                </Menu.Item>
              ) : null}
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
