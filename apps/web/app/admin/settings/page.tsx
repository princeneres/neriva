'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Code,
  Divider,
  Group,
  List,
  NumberInput,
  Select,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconLock,
  IconPencil,
  IconPlus,
  IconServerCog,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCursorList } from '../../../components/data-table';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';
import { useSite } from '../../../lib/site-context';
import {
  type CatalogEntry,
  type CatalogGroup,
  type FieldValue,
  type SettingsCatalog,
  type SystemSetting,
  fieldError,
  hasIncompatibleValue,
  initialFieldValue,
  planSave,
  previewValue,
} from './shared';

const SKELETON_ROWS = 3;

const CUSTOM_LIST_PATH = '/system/settings?limit=100';

// Infrastructure that stays environment-level configuration (CLAUDE.md): the
// portal describes it so nobody hunts for a field that will never be here,
// and shows no values, since some of these are secrets.
const SERVER_MANAGED = [
  { label: 'Database connection', env: 'DATABASE_URL' },
  { label: 'Where uploaded files are kept', env: 'MEDIA_STORAGE_DIR' },
  { label: 'Largest file that can be uploaded', env: 'MEDIA_MAX_UPLOAD_BYTES' },
  {
    label: 'Sign-in token secret and lifetimes',
    env: 'JWT_ACCESS_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_TTL',
  },
  { label: 'Address the admin is served from', env: 'WEB_ORIGIN' },
];

function settingPath(key: string): string {
  return `/system/settings/${encodeURIComponent(key)}`;
}

function SettingField({
  entry,
  value,
  error,
  showEffect,
  siteOptions,
  onChange,
}: {
  entry: CatalogEntry;
  value: FieldValue;
  error: string | null;
  showEffect: boolean;
  siteOptions: { value: string; label: string }[];
  onChange: (next: FieldValue) => void;
}) {
  const label = (
    <Group gap={6} wrap="nowrap" component="span">
      <span>{entry.label}</span>
      <HelpTip label={entry.effectNote} />
      {showEffect && entry.effect === 'STORED' ? (
        <Badge size="xs" variant="light" color="slate">
          Not used yet
        </Badge>
      ) : null}
    </Group>
  );

  if (hasIncompatibleValue(entry)) {
    return (
      <TextInput
        label={label}
        description={
          <>
            Saved as JSON that does not fit this field.{' '}
            <Link href={`/admin/settings/${encodeURIComponent(entry.key)}`}>Edit it as JSON</Link>{' '}
            to change it.
          </>
        }
        value={previewValue(entry.value)}
        readOnly
        mb="md"
      />
    );
  }

  if (entry.type === 'boolean') {
    return (
      <Switch
        label={label}
        description={entry.description}
        checked={value === true}
        onChange={(event) => onChange(event.currentTarget.checked)}
        mb="md"
      />
    );
  }

  if (entry.type === 'number') {
    return (
      <NumberInput
        label={label}
        description={entry.description}
        placeholder={entry.placeholder ?? undefined}
        value={typeof value === 'string' ? value : ''}
        error={error}
        onChange={(next) => onChange(next === '' ? '' : String(next))}
        mb="md"
      />
    );
  }

  if (entry.type === 'select') {
    const options = entry.optionsSource === 'SITES' ? siteOptions : (entry.options ?? []);
    const current = typeof value === 'string' && value !== '' ? value : null;
    const data =
      current && !options.some((option) => option.value === current)
        ? [...options, { value: current, label: `${current} (no site with this address)` }]
        : options;
    return (
      <Select
        label={label}
        description={entry.description}
        data={data}
        value={current}
        clearable
        searchable
        placeholder="Automatic: the first site you created"
        nothingFoundMessage="No sites yet"
        error={error}
        onChange={(next) => onChange(next ?? '')}
        mb="md"
      />
    );
  }

  if (entry.type === 'password') {
    return (
      <TextInput
        type="password"
        label={label}
        description={
          entry.isSet
            ? 'A value is saved. Leave this blank to keep it, or type a new one to replace it.'
            : entry.description
        }
        placeholder={entry.isSet ? '••••••••' : undefined}
        value={typeof value === 'string' ? value : ''}
        error={error}
        onChange={(event) => onChange(event.currentTarget.value)}
        mb={entry.isSet ? 4 : 'md'}
        rightSection={entry.isSet ? <IconLock size={15} /> : undefined}
      />
    );
  }

  const Input = entry.type === 'text' ? Textarea : TextInput;
  return (
    <Input
      label={label}
      description={entry.description}
      placeholder={entry.placeholder ?? undefined}
      value={typeof value === 'string' ? value : ''}
      error={error}
      onChange={(event) => onChange(event.currentTarget.value)}
      mb="md"
    />
  );
}

function GroupCard({
  group,
  entries,
  siteOptions,
  onSaved,
}: {
  group: CatalogGroup;
  entries: CatalogEntry[];
  siteOptions: { value: string; label: string }[];
  onSaved: () => Promise<void>;
}) {
  const [fields, setFields] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(entries.map((entry) => [entry.key, initialFieldValue(entry)])),
  );
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // A save reloads the catalog, so the inputs restart from what is stored.
  useEffect(() => {
    setFields(Object.fromEntries(entries.map((entry) => [entry.key, initialFieldValue(entry)])));
  }, [entries]);

  const errors = useMemo(
    () =>
      Object.fromEntries(
        entries.map((entry) => [entry.key, fieldError(entry, fields[entry.key] ?? '')]),
      ),
    [entries, fields],
  );
  const hasErrors = Object.values(errors).some((message) => message !== null);
  const actions = planSave(entries, fields);
  const mixedEffects =
    entries.some((entry) => entry.effect === 'APPLIED') &&
    entries.some((entry) => entry.effect === 'STORED');

  async function save() {
    setFormError(null);
    setBusy(true);
    try {
      for (const action of actions) {
        if (action.method === 'DELETE') {
          await api.del(settingPath(action.key));
        } else {
          await api.put(settingPath(action.key), { value: action.value });
        }
      }
      notifications.show({ color: 'green', message: `${group.label} saved` });
      await onSaved();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  function confirmClear(entry: CatalogEntry) {
    modals.openConfirmModal({
      title: `Remove ${entry.label.toLowerCase()}`,
      children: (
        <Text size="sm">
          Delete the saved value of <Code>{entry.key}</Code>? It goes back to being unset.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(settingPath(entry.key));
            notifications.show({ color: 'green', message: `${entry.label} removed` });
            await onSaved();
          } catch (error) {
            notifications.show({
              color: 'red',
              message: error instanceof ApiError ? error.message : 'Remove failed',
            });
          }
        })();
      },
    });
  }

  return (
    <Card padding="xl" mb="lg" maw={720}>
      <Title order={2} fz="h4">
        {group.label}
      </Title>
      <Text size="sm" c="slate.5" mb="md">
        {group.description}
      </Text>

      {group.notice ? (
        <Alert
          color="yellow"
          variant="light"
          icon={<IconAlertTriangle size={18} />}
          title="Nothing reads these yet"
          mb="md"
        >
          {group.notice}
        </Alert>
      ) : null}

      {formError ? (
        <Alert color="red" mb="md">
          {formError}
        </Alert>
      ) : null}

      {entries.map((entry) => (
        <div key={entry.key}>
          <SettingField
            entry={entry}
            value={fields[entry.key] ?? ''}
            error={errors[entry.key] ?? null}
            showEffect={mixedEffects}
            siteOptions={siteOptions}
            onChange={(next) => setFields((current) => ({ ...current, [entry.key]: next }))}
          />
          {entry.type === 'password' && entry.isSet ? (
            <Group justify="flex-end" mb="md">
              <Button
                size="compact-xs"
                variant="subtle"
                color="red"
                onClick={() => confirmClear(entry)}
              >
                Remove saved value
              </Button>
            </Group>
          ) : null}
        </div>
      ))}

      <Group>
        <Button
          onClick={() => void save()}
          loading={busy}
          disabled={hasErrors || actions.length === 0}
        >
          Save
        </Button>
        <Text size="sm" c="slate.5">
          {actions.length === 0 ? 'No changes yet' : `${actions.length} change(s) to save`}
        </Text>
      </Group>
    </Card>
  );
}

export default function SettingsPage() {
  const { sites } = useSite();
  const [catalog, setCatalog] = useState<SettingsCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const {
    items,
    loading,
    hasMore,
    refresh: refreshList,
    loadMore,
  } = useCursorList<SystemSetting>(CUSTOM_LIST_PATH, (error) =>
    notifications.show({ color: 'red', message: error.message }),
  );

  const loadCatalog = useCallback(async () => {
    try {
      const body = await api.get<{ data: SettingsCatalog }>('/system/settings-catalog');
      setCatalog(body.data);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(error instanceof ApiError ? error.message : 'Failed to load settings');
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const reload = useCallback(async () => {
    await Promise.all([loadCatalog(), refreshList()]);
  }, [loadCatalog, refreshList]);

  const siteOptions = useMemo(
    () => sites.map((site) => ({ value: site.slug, label: `${site.name} (/${site.slug})` })),
    [sites],
  );

  const knownKeys = useMemo(
    () => new Set((catalog?.settings ?? []).map((entry) => entry.key)),
    [catalog],
  );
  // The guided forms above own their keys; this table is only for keys nobody
  // has described, which the API still accepts and stores.
  const customItems = items.filter((setting) => !knownKeys.has(setting.key));

  async function deleteSetting(setting: SystemSetting) {
    try {
      await api.del(settingPath(setting.key));
      notifications.show({ color: 'green', message: `Setting "${setting.key}" deleted` });
      await reload();
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof ApiError ? error.message : 'Delete failed',
      });
    }
  }

  function confirmDelete(setting: SystemSetting) {
    modals.openConfirmModal({
      title: 'Delete setting',
      children: (
        <Text size="sm">
          Delete the setting <Code>{setting.key}</Code>? Anything that reads it will fall back to
          its default behavior.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => void deleteSetting(setting),
    });
  }

  const showEmptyCustom = !loading && customItems.length === 0;
  const showSkeleton = loading && items.length === 0;

  return (
    <>
      <Group justify="space-between" mb="lg" align="flex-start">
        <div>
          <Title order={1} fz="h2">
            Settings
          </Title>
          <Text c="slate.5" maw={640}>
            How this Neriva install behaves. Each field says plainly whether the product reads it
            today or only stores it.
          </Text>
        </div>
        <Button
          component={Link}
          href="/admin/settings/new"
          variant="default"
          leftSection={<IconPlus size={16} />}
        >
          New custom setting
        </Button>
      </Group>

      {catalogError ? (
        <Alert color="red" maw={720} mb="lg">
          {catalogError}
        </Alert>
      ) : null}

      {catalog === null && catalogError === null
        ? Array.from({ length: 2 }, (_, index) => (
            <Card key={index} padding="xl" mb="lg" maw={720}>
              <Skeleton height={16} width="30%" mb="sm" />
              <Skeleton height={12} width="60%" mb="lg" />
              <Skeleton height={54} mb="md" />
              <Skeleton height={54} />
            </Card>
          ))
        : null}

      {catalog?.groups.map((group) => {
        const entries = catalog.settings.filter((entry) => entry.group === group.id);
        if (entries.length === 0) {
          return null;
        }
        return (
          <GroupCard
            key={group.id}
            group={group}
            entries={entries}
            siteOptions={siteOptions}
            onSaved={reload}
          />
        );
      })}

      <Card padding="xl" mb="lg" maw={720}>
        <Group gap={6} mb={2}>
          <Title order={2} fz="h4">
            Custom settings
          </Title>
          <HelpTip label="Any other key/value pair stored through the API. Useful for your own integrations; Neriva itself does not read these." />
        </Group>
        <Text size="sm" c="slate.5" mb="md">
          Named values that are not part of the list above. They are stored as raw JSON and read by
          whatever you build against the API.
        </Text>

        {showEmptyCustom ? (
          <Stack align="center" py="lg" gap="sm">
            <ThemeIcon size={40} radius="xl" variant="light">
              <IconSettings size={20} stroke={1.7} />
            </ThemeIcon>
            <Text c="slate.5" ta="center" maw={420} size="sm">
              No custom settings. Everything this install needs is in the sections above.
            </Text>
            <Button
              component={Link}
              href="/admin/settings/new"
              variant="light"
              leftSection={<IconPlus size={16} />}
            >
              New custom setting
            </Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={620} type="native">
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    Key
                    <HelpTip label="The unique name used to look this setting up, in the admin and through the API." />
                  </Table.Th>
                  <Table.Th>
                    Value
                    <HelpTip label="Stored as JSON: text, a number, true/false, or a whole object." />
                  </Table.Th>
                  <Table.Th>Updated</Table.Th>
                  <Table.Th aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {showSkeleton
                  ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <Skeleton height={12} width="60%" />
                        </Table.Td>
                        <Table.Td>
                          <Skeleton height={12} width="80%" />
                        </Table.Td>
                        <Table.Td>
                          <Skeleton height={12} width="50%" />
                        </Table.Td>
                        <Table.Td />
                      </Table.Tr>
                    ))
                  : customItems.map((setting) => (
                      <Table.Tr key={setting.id}>
                        <Table.Td>
                          <Code>{setting.key}</Code>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" ff="monospace" c="slate.6">
                            {setting.isSensitive ? 'hidden' : previewValue(setting.value)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="slate.5">
                            {new Date(setting.updatedAt).toLocaleString()}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            <Tooltip label="Edit value">
                              <ActionIcon
                                component={Link}
                                href={`/admin/settings/${encodeURIComponent(setting.key)}`}
                                variant="subtle"
                                aria-label={`Edit ${setting.key}`}
                              >
                                <IconPencil size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label={`Delete ${setting.key}`}
                                onClick={() => confirmDelete(setting)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}

        {hasMore ? (
          <Center mt="md">
            <Button variant="light" loading={loading} onClick={() => void loadMore()}>
              Load more
            </Button>
          </Center>
        ) : null}
      </Card>

      <Card padding="xl" maw={720} bg="slate.0">
        <Group gap={8} mb={2}>
          <ThemeIcon size={26} radius="xl" variant="light" color="slate">
            <IconServerCog size={15} stroke={1.8} />
          </ThemeIcon>
          <Title order={2} fz="h5">
            Managed by the server
          </Title>
        </Group>
        <Text size="sm" c="slate.5" mb="sm">
          These are read from the server environment when Neriva starts, never from this screen, so
          a wrong value here could not take the site offline. Ask whoever runs the server to change
          them.
        </Text>
        <Divider mb="sm" />
        <List size="sm" spacing={6} listStyleType="none">
          {SERVER_MANAGED.map((item) => (
            <List.Item key={item.env}>
              <Text size="sm" span>
                {item.label}
              </Text>{' '}
              <Code>{item.env}</Code>
            </List.Item>
          ))}
        </List>
      </Card>
    </>
  );
}
