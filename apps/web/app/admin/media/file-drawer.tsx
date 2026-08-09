'use client';

import {
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Image,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconLink, IconTrash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';
import { apiUrl } from '../../../lib/api-url';
import {
  ALT_TEXT_HELP,
  fileExtension,
  fileTypeIcon,
  formatBytes,
  isImage,
  type MediaFile,
  type MediaFolder,
} from './types';

const ROOT_OPTION = { value: 'root', label: 'Library (root)' };

// Flatten the folder tree into Select options labeled with the full path.
// Breadth-first walk over the children listing, capped to stay cheap.
async function loadFolderOptions(): Promise<{ value: string; label: string }[]> {
  const options: { value: string; label: string }[] = [ROOT_OPTION];
  const queue: { id: string; label: string }[] = [{ id: 'root', label: '' }];
  while (queue.length > 0 && options.length < 200) {
    const next = queue.shift();
    if (!next) {
      break;
    }
    const page = await api.get<{ data: MediaFolder[] }>(
      `/media/folders?parent=${next.id}&limit=100`,
    );
    for (const folder of page.data) {
      const label = next.label ? `${next.label} / ${folder.name}` : folder.name;
      options.push({ value: folder.id, label });
      queue.push({ id: folder.id, label });
    }
  }
  return options;
}

interface FileDrawerProps {
  file: MediaFile | null;
  opened: boolean;
  onClose: () => void;
  // Called after any change (save, move, delete) so the browser can refresh.
  onChanged: () => void;
}

interface FileFormValues {
  fileName: string;
  alt: string;
  folder: string;
}

export function FileDrawer({ file, opened, onClose, onChanged }: FileDrawerProps) {
  const [folderOptions, setFolderOptions] = useState<{ value: string; label: string }[]>([
    ROOT_OPTION,
  ]);
  const [saving, setSaving] = useState(false);

  const form = useForm<FileFormValues>({
    initialValues: { fileName: '', alt: '', folder: 'root' },
    validate: {
      fileName: (value) => (value.trim() === '' ? 'File name is required' : null),
    },
  });

  // Sync the form and reload the folder options whenever another file opens.
  useEffect(() => {
    if (!opened || !file) {
      return;
    }
    form.setValues({
      fileName: file.fileName,
      alt: file.alt ?? '',
      folder: file.folderId ?? 'root',
    });
    form.clearErrors();
    let cancelled = false;
    void (async () => {
      try {
        const options = await loadFolderOptions();
        if (!cancelled) {
          setFolderOptions(options);
        }
      } catch {
        // keep the root-only option; moving to root stays possible
      }
    })();
    return () => {
      cancelled = true;
    };
    // `form` is stable; keying on the file id avoids resetting on every render.
  }, [opened, file?.id]);

  async function handleSave(values: FileFormValues) {
    if (!file) {
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/media/files/${file.id}`, {
        fileName: values.fileName.trim(),
        alt: values.alt.trim() === '' ? null : values.alt.trim(),
        folderId: values.folder === 'root' ? null : values.folder,
      });
      notifications.show({
        color: 'green',
        title: 'File updated',
        message: `"${values.fileName.trim()}" was saved.`,
      });
      onChanged();
      onClose();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not save',
        message: error instanceof ApiError ? error.message : 'Failed to update the file.',
      });
    } finally {
      setSaving(false);
    }
  }

  function copyUrl() {
    if (!file) {
      return;
    }
    void navigator.clipboard.writeText(apiUrl(file.url)).then(
      () =>
        notifications.show({
          color: 'green',
          title: 'URL copied',
          message: 'Paste it into an Image block.',
        }),
      () =>
        notifications.show({
          color: 'red',
          title: 'Could not copy',
          message: 'Your browser blocked clipboard access.',
        }),
    );
  }

  function confirmDelete() {
    if (!file) {
      return;
    }
    const target = file;
    modals.openConfirmModal({
      title: 'Delete file',
      children: (
        <Text size="sm">
          Delete <strong>{target.fileName}</strong>? The file will be removed from every page that
          uses it. This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete file', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/media/files/${target.id}`);
            notifications.show({
              color: 'green',
              title: 'File deleted',
              message: `"${target.fileName}" was deleted.`,
            });
            onChanged();
            onClose();
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Could not delete',
              message: error instanceof ApiError ? error.message : 'Failed to delete the file.',
            });
          }
        })();
      },
    });
  }

  const TypeIcon = file ? fileTypeIcon(file.contentType) : null;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={
        <Text fw={600} truncate maw={340}>
          {file?.fileName ?? 'File'}
        </Text>
      }
    >
      {file ? (
        <Stack gap="md">
          {isImage(file.contentType) ? (
            <Image
              src={apiUrl(file.url)}
              alt={file.alt ?? file.fileName}
              radius="md"
              mah={260}
              fit="contain"
              bg="var(--mantine-color-slate-1)"
            />
          ) : (
            <Stack align="center" gap={6} py="lg">
              {TypeIcon ? (
                <ThemeIcon size={56} radius="md" variant="light" color="slate">
                  <TypeIcon size={32} stroke={1.5} />
                </ThemeIcon>
              ) : null}
              <Badge color="gray" variant="light">
                {fileExtension(file.fileName)}
              </Badge>
            </Stack>
          )}

          <form onSubmit={form.onSubmit((values) => void handleSave(values))}>
            <Stack gap="sm">
              <TextInput label="File name" {...form.getInputProps('fileName')} />
              {isImage(file.contentType) ? (
                <Textarea
                  label={
                    <>
                      Alt text
                      <HelpTip label={ALT_TEXT_HELP} />
                    </>
                  }
                  placeholder="Describe what the image shows"
                  autosize
                  minRows={2}
                  {...form.getInputProps('alt')}
                />
              ) : null}
              <Select
                label="Folder"
                description="Move the file by picking another folder"
                data={folderOptions}
                allowDeselect={false}
                searchable
                {...form.getInputProps('folder')}
              />
              <Group justify="flex-end">
                <Button type="submit" loading={saving}>
                  Save changes
                </Button>
              </Group>
            </Stack>
          </form>

          <Divider />

          <Card withBorder padding="sm" bg="var(--mantine-color-slate-0)">
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <Text size="xs" c="slate.5">
                  Type
                </Text>
                <Text size="xs">{file.contentType}</Text>
              </Group>
              <Group justify="space-between" wrap="nowrap">
                <Text size="xs" c="slate.5">
                  Size
                </Text>
                <Text size="xs">{formatBytes(file.sizeBytes)}</Text>
              </Group>
              <Group justify="space-between" wrap="nowrap">
                <Text size="xs" c="slate.5">
                  Created
                </Text>
                <Text size="xs">{new Date(file.createdAt).toLocaleString()}</Text>
              </Group>
            </Stack>
          </Card>

          <Group>
            <Button variant="light" leftSection={<IconLink size={16} />} onClick={copyUrl}>
              Copy URL
            </Button>
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Drawer>
  );
}
