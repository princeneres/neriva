'use client';

import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Code,
  Group,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconBrush,
  IconExternalLink,
  IconRocket,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError, api } from '../../../../lib/api';
import { publicPageUrl, useSite } from '../../../../lib/site-context';
import { PATH_PATTERN } from '../tree-utils';
import { type Page, type PageTemplate, statusColor } from '../types';

const PATH_ERROR =
  'The path must start with "/" and use only lowercase letters, digits, "/" and "-".';

// Value the Select uses for "no explicit master, use the site/tenant
// default"; the API accepts an omitted/null masterPageTemplateId for that.
const SITE_DEFAULT_MASTER = '__site_default__';

interface SettingsValues {
  title: string;
  path: string;
  masterPageTemplateId: string;
}

const FIELD_NAMES = ['title', 'path', 'masterPageTemplateId'] as const;

function SettingsForm({ page, onSaved }: { page: Page; onSaved: (page: Page) => void }) {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [masters, setMasters] = useState<PageTemplate[]>([]);

  useEffect(() => {
    api
      .get<{ data: PageTemplate[] }>('/page-templates?kind=MASTER&limit=100')
      .then(({ data }) => setMasters(data))
      .catch(() => setMasters([]));
  }, []);

  const form = useForm<SettingsValues>({
    initialValues: {
      title: page.title,
      path: page.path,
      masterPageTemplateId: page.masterPageTemplateId ?? SITE_DEFAULT_MASTER,
    },
    validate: {
      title: (value) => (value.trim() ? null : 'Give the page a title'),
      path: (value) => (PATH_PATTERN.test(value) ? null : PATH_ERROR),
    },
  });

  async function handleSubmit(values: SettingsValues) {
    setBusy(true);
    setFormError(null);
    try {
      const { data } = await api.patch<{ data: Page }>(`/pages/${page.id}`, {
        title: values.title.trim(),
        path: values.path,
        masterPageTemplateId:
          values.masterPageTemplateId === SITE_DEFAULT_MASTER ? null : values.masterPageTemplateId,
      });
      onSaved(data);
      form.setValues({
        title: data.title,
        path: data.path,
        masterPageTemplateId: data.masterPageTemplateId ?? SITE_DEFAULT_MASTER,
      });
      notifications.show({ color: 'green', message: 'Page settings saved.' });
    } catch (err) {
      // class-validator messages start with the property name ("path must match ...").
      const problemErrors = err instanceof ApiError ? (err.problem.errors ?? []) : [];
      const unmatched: string[] = [];
      for (const message of problemErrors) {
        const field = FIELD_NAMES.find((name) => message.toLowerCase().startsWith(name));
        if (field) {
          form.setFieldError(field, message);
        } else {
          unmatched.push(message);
        }
      }
      if (unmatched.length > 0) {
        setFormError(unmatched.join(' '));
      } else if (problemErrors.length === 0) {
        setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
      <Stack gap="md">
        {formError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {formError}
          </Alert>
        ) : null}
        <TextInput
          label="Title"
          description="The name of the page, shown in menus and browser tabs."
          required
          maxLength={255}
          {...form.getInputProps('title')}
        />
        <TextInput
          label={
            <>
              Path
              <HelpTip label="The address of the page inside its site, for example /about. Only lowercase letters, digits, / and - are allowed." />
            </>
          }
          description="Where the page lives, for example /about."
          required
          maxLength={255}
          placeholder="/home"
          {...form.getInputProps('path')}
        />
        <Select
          label={
            <>
              Master page
              <HelpTip label="The shared header and footer this page renders inside. Leave it on the site default unless this page needs a different one." />
            </>
          }
          data={[
            { value: SITE_DEFAULT_MASTER, label: 'Use the site default' },
            ...masters.map((master) => ({ value: master.id, label: master.name })),
          ]}
          allowDeselect={false}
          {...form.getInputProps('masterPageTemplateId')}
        />
        <Group mt="xs">
          <Button type="submit" loading={busy}>
            Save changes
          </Button>
          <Button component={Link} href="/admin/pages" variant="subtle" color="slate">
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

// Page settings: configuration only (title, path, publishing, deletion).
// Blocks and styles are edited in the studio, one click away via
// "Edit page content".
export default function PageSettingsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { sites } = useSite();
  const [page, setPage] = useState<Page | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    api
      .get<{ data: Page }>(`/pages/${id}`)
      .then(({ data }) => setPage(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load the page');
      });
  }, [id]);

  const siteSlug = page ? (sites.find((site) => site.id === page.siteId)?.slug ?? null) : null;
  const viewUrl =
    page !== null && page.status === 'PUBLISHED' && siteSlug !== null
      ? publicPageUrl(siteSlug, page.path)
      : null;

  function confirmPublish(current: Page) {
    modals.openConfirmModal({
      title: 'Publish page',
      children: (
        <Text size="sm">
          Publish &quot;{current.title}&quot;? It becomes visible to visitors at{' '}
          <Code>{current.path}</Code>.
        </Text>
      ),
      labels: { confirm: 'Publish', cancel: 'Not yet' },
      onConfirm: () => void publish(current),
    });
  }

  async function publish(current: Page) {
    setPublishing(true);
    try {
      const { data } = await api.post<{ data: Page }>(`/pages/${current.id}/publish`);
      setPage(data);
      notifications.show({ color: 'green', message: `"${data.title}" is now published.` });
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Publish failed',
        message: err instanceof ApiError ? err.message : 'Failed to publish the page',
        autoClose: 10000,
      });
    } finally {
      setPublishing(false);
    }
  }

  function confirmDelete(current: Page) {
    modals.openConfirmModal({
      title: 'Delete page',
      children: (
        <Text size="sm">
          Delete &quot;{current.title}&quot; and everything on it? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => void remove(current),
    });
  }

  async function remove(current: Page) {
    try {
      await api.del(`/pages/${current.id}`);
      notifications.show({ color: 'green', message: `"${current.title}" was deleted.` });
      router.push('/admin/pages');
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Delete failed',
        message: err instanceof ApiError ? err.message : 'Failed to delete the page',
      });
    }
  }

  if (loadError !== null) {
    return (
      <Box maw={640}>
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Could not load the page">
          <Text size="sm">{loadError}</Text>
          <Anchor component={Link} href="/admin/pages" size="sm" fw={600}>
            Back to pages
          </Anchor>
        </Alert>
      </Box>
    );
  }

  if (page === null) {
    return (
      <Box maw={720}>
        <Stack gap="md">
          <Skeleton height={36} width={280} radius="md" />
          <Skeleton height={220} radius="lg" />
          <Skeleton height={120} radius="lg" />
        </Stack>
      </Box>
    );
  }

  return (
    <Box maw={720}>
      <Group justify="space-between" mb="lg" align="flex-start">
        <Box>
          <Group gap="sm" mb={2}>
            <Title order={1} fz="h2">
              {page.title}
            </Title>
            <Badge color={statusColor(page.status)}>{page.status}</Badge>
          </Group>
          <Text c="slate.5">
            Page settings: the name, the address and publishing. The content itself is edited on the
            page.
          </Text>
        </Box>
        <Button
          component={Link}
          href={`/admin/pages/${page.id}/design`}
          leftSection={<IconBrush size={16} />}
        >
          Edit page content
        </Button>
      </Group>

      <Card padding="xl" mb="md">
        <SettingsForm page={page} onSaved={setPage} />
      </Card>

      <Card padding="lg" mb="md">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Group gap="xs" mb={4}>
              <Text size="sm" fw={600}>
                Publishing
              </Text>
              <Badge color={statusColor(page.status)}>{page.status}</Badge>
            </Group>
            <Text size="xs" c="slate.5" maw={380}>
              {page.status === 'PUBLISHED'
                ? 'This page is live. Saved changes only reach visitors when you publish again.'
                : page.status === 'ARCHIVED'
                  ? 'This page is archived and not visible to visitors.'
                  : 'Drafts are safe to work on; visitors only see the page after you publish it.'}
            </Text>
          </Box>
          <Group gap="xs">
            {viewUrl !== null ? (
              <Button
                component="a"
                href={viewUrl}
                target="_blank"
                rel="noopener"
                variant="default"
                leftSection={<IconExternalLink size={15} />}
              >
                View page
              </Button>
            ) : null}
            <Button
              variant="light"
              leftSection={<IconRocket size={15} />}
              loading={publishing}
              onClick={() => confirmPublish(page)}
            >
              Publish
            </Button>
          </Group>
        </Group>
      </Card>

      <Card padding="lg" bg="slate.0" mb="md">
        <Text size="sm" fw={600} mb="xs">
          Record details
        </Text>
        <Stack gap={6}>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" c="slate.5" w={140} style={{ flexShrink: 0 }}>
              ID
            </Text>
            <Code>{page.id}</Code>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" c="slate.5" w={140} style={{ flexShrink: 0 }}>
              Reference code
              <HelpTip label="A stable code other systems can use to find this page, for example during imports or migrations. It never changes when the page is renamed." />
            </Text>
            <Code>{page.externalReferenceCode}</Code>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" c="slate.5" w={140} style={{ flexShrink: 0 }}>
              Created
            </Text>
            <Text size="sm">{new Date(page.createdAt).toLocaleString()}</Text>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" c="slate.5" w={140} style={{ flexShrink: 0 }}>
              Updated
            </Text>
            <Text size="sm">{new Date(page.updatedAt).toLocaleString()}</Text>
          </Group>
        </Stack>
      </Card>

      <Card padding="lg">
        <Group justify="space-between" align="center">
          <Box>
            <Text size="sm" fw={600}>
              Delete this page
            </Text>
            <Text size="xs" c="slate.5">
              Removes the page and everything on it. This cannot be undone.
            </Text>
          </Box>
          <Button
            color="red"
            variant="light"
            leftSection={<IconTrash size={15} />}
            onClick={() => confirmDelete(page)}
          >
            Delete page
          </Button>
        </Group>
      </Card>
    </Box>
  );
}
