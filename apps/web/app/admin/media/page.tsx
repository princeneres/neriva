'use client';

import '@mantine/dropzone/styles.css';

import {
  ActionIcon,
  AspectRatio,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Group,
  Image,
  Menu,
  Modal,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { Dropzone, type FileWithPath } from '@mantine/dropzone';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconDots,
  IconFolder,
  IconFolderPlus,
  IconFolderSymlink,
  IconPencil,
  IconPhoto,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { useCursorList } from '../../../components/data-table';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';
import { apiUrl } from '../../../lib/api-url';
import { useSite } from '../../../lib/site-context';
import { FileDrawer } from './file-drawer';
import { uploadFile } from './upload';
import {
  MAX_UPLOAD_BYTES,
  MEDIA_HELP,
  SITE_FOLDER_HELP,
  fileExtension,
  fileTypeIcon,
  formatBytes,
  isImage,
  type MediaFile,
  type MediaFolder,
} from './types';

const SKELETON_CARDS = [1, 2, 3, 4, 5];

// Locate a site's default media folder (spec 11: `Sites/<site name>` with
// `siteId` set). Returns the breadcrumb path to it, or null when it does not
// exist yet (it is created by the first upload with a `site` ref).
async function findSiteFolderPath(siteId: string): Promise<MediaFolder[] | null> {
  const root = await api.get<{ data: MediaFolder[] }>('/media/folders?parent=root&limit=100');
  const direct = root.data.find((folder) => folder.siteId === siteId);
  if (direct) {
    return [direct];
  }
  const sitesFolder = root.data.find((folder) => folder.name === 'Sites');
  if (!sitesFolder) {
    return null;
  }
  const children = await api.get<{ data: MediaFolder[] }>(
    `/media/folders?parent=${sitesFolder.id}&limit=100`,
  );
  const siteFolder = children.data.find((folder) => folder.siteId === siteId);
  return siteFolder ? [sitesFolder, siteFolder] : null;
}

type FolderModalState = { mode: 'create' } | { mode: 'rename'; folder: MediaFolder } | null;

export default function MediaLibraryPage() {
  const { current: site } = useSite();

  // Breadcrumb path from the root; the current folder is the last entry.
  const [path, setPath] = useState<MediaFolder[]>([]);
  const currentFolder = path.at(-1) ?? null;
  const folderKey = currentFolder?.id ?? 'root';

  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const page = await api.get<{ data: MediaFolder[] }>(
        `/media/folders?parent=${folderKey}&limit=100`,
      );
      setFolders(page.data);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not load folders',
        message: error instanceof ApiError ? error.message : 'Failed to load folders.',
      });
    } finally {
      setFoldersLoading(false);
    }
  }, [folderKey]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const {
    items: files,
    loading: filesLoading,
    hasMore,
    refresh: refreshFiles,
    loadMore,
  } = useCursorList<MediaFile>(`/media/files?folder=${folderKey}`, (error) =>
    notifications.show({ color: 'red', title: 'Could not load files', message: error.message }),
  );

  const [showDropzone, setShowDropzone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [folderModal, setFolderModal] = useState<FolderModalState>(null);
  const [folderSaving, setFolderSaving] = useState(false);

  // "Go to <site> folder" affordance: only meaningful at root with a site
  // selected, and only when the default folder already exists.
  const [siteFolderPath, setSiteFolderPath] = useState<MediaFolder[] | null>(null);
  const atRoot = currentFolder === null;
  useEffect(() => {
    setSiteFolderPath(null);
    if (!atRoot || !site) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const found = await findSiteFolderPath(site.id);
        if (!cancelled) {
          setSiteFolderPath(found);
        }
      } catch {
        // the hint is best-effort; stay silent
      }
    })();
    return () => {
      cancelled = true;
    };
    // `folders` retriggers discovery after uploads or folder changes at root.
  }, [atRoot, site, folders]);

  const folderForm = useForm<{ name: string }>({
    initialValues: { name: '' },
    validate: { name: (value) => (value.trim() === '' ? 'Name is required' : null) },
  });

  function openCreateFolder() {
    folderForm.setValues({ name: '' });
    folderForm.clearErrors();
    setFolderModal({ mode: 'create' });
  }

  function openRenameFolder(folder: MediaFolder) {
    folderForm.setValues({ name: folder.name });
    folderForm.clearErrors();
    setFolderModal({ mode: 'rename', folder });
  }

  async function handleFolderSubmit({ name }: { name: string }) {
    if (!folderModal) {
      return;
    }
    const trimmed = name.trim();
    setFolderSaving(true);
    try {
      if (folderModal.mode === 'rename') {
        await api.patch(`/media/folders/${folderModal.folder.id}`, { name: trimmed });
        notifications.show({
          color: 'green',
          title: 'Folder renamed',
          message: `The folder is now called "${trimmed}".`,
        });
      } else {
        await api.post(
          '/media/folders',
          currentFolder ? { name: trimmed, parent: currentFolder.id } : { name: trimmed },
        );
        notifications.show({
          color: 'green',
          title: 'Folder created',
          message: `"${trimmed}" was created.`,
        });
      }
      setFolderModal(null);
      await loadFolders();
    } catch (error) {
      // e.g. 409 when a sibling folder already has this name
      folderForm.setFieldError(
        'name',
        error instanceof ApiError ? error.message : 'Could not save the folder.',
      );
    } finally {
      setFolderSaving(false);
    }
  }

  function confirmDeleteFolder(folder: MediaFolder) {
    modals.openConfirmModal({
      title: 'Delete folder',
      children: (
        <Text size="sm">
          Delete <strong>{folder.name}</strong> and everything inside it? All of its subfolders and
          files will be permanently deleted too. This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete folder', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/media/folders/${folder.id}`);
            notifications.show({
              color: 'green',
              title: 'Folder deleted',
              message: `"${folder.name}" and its contents were deleted.`,
            });
            await loadFolders();
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Could not delete',
              message: error instanceof ApiError ? error.message : 'Failed to delete the folder.',
            });
          }
        })();
      },
    });
  }

  async function handleDrop(dropped: FileWithPath[]) {
    setUploading(true);
    const toSiteDefault = atRoot && site !== null;
    let uploaded = 0;
    for (const file of dropped) {
      const notificationId = `media-upload-${file.name}-${Date.now()}`;
      notifications.show({
        id: notificationId,
        loading: true,
        title: 'Uploading',
        message: file.name,
        autoClose: false,
        withCloseButton: false,
      });
      const formData = new FormData();
      formData.append('file', file);
      if (currentFolder) {
        formData.append('folderId', currentFolder.id);
      } else if (site) {
        // At root with a site selected the API files it into the site's
        // default folder (creating it on first upload).
        formData.append('site', site.id);
      }
      try {
        await uploadFile('/media/files', formData);
        uploaded += 1;
        notifications.update({
          id: notificationId,
          color: 'green',
          loading: false,
          title: 'Uploaded',
          message: file.name,
          autoClose: 4000,
          withCloseButton: true,
        });
      } catch (error) {
        notifications.update({
          id: notificationId,
          color: 'red',
          loading: false,
          title: 'Upload failed',
          message:
            error instanceof ApiError ? `${file.name}: ${error.message}` : `${file.name} failed.`,
          autoClose: 6000,
          withCloseButton: true,
        });
      }
    }
    setUploading(false);
    if (uploaded === 0) {
      return;
    }
    if (toSiteDefault && site) {
      try {
        const found = await findSiteFolderPath(site.id);
        if (found) {
          // Navigating re-triggers both listings for the new folder.
          setShowDropzone(false);
          setPath(found);
          return;
        }
      } catch {
        // fall through to a plain refresh
      }
    }
    await Promise.all([refreshFiles(), loadFolders()]);
  }

  function handleReject(rejections: { file: File }[]) {
    for (const rejection of rejections) {
      notifications.show({
        color: 'red',
        title: 'File not accepted',
        message: `${rejection.file.name} is larger than the 25 MB upload limit.`,
      });
    }
  }

  const onFileChanged = useCallback(() => {
    void refreshFiles();
  }, [refreshFiles]);

  const initialLoading = foldersLoading && filesLoading && files.length === 0;
  const libraryEmpty =
    !foldersLoading && !filesLoading && folders.length === 0 && files.length === 0;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap={6}>
            <Title order={1} fz="h2">
              Media
            </Title>
            <HelpTip label={MEDIA_HELP} />
          </Group>
          <Text c="slate.5">
            Upload images and documents once, then reuse them across your pages.
          </Text>
        </div>
        <Group gap="xs">
          {atRoot && site && siteFolderPath ? (
            <Group gap={4}>
              <Button
                variant="light"
                leftSection={<IconFolderSymlink size={16} />}
                onClick={() => setPath(siteFolderPath)}
              >
                Go to {site.name} folder
              </Button>
              <HelpTip label={SITE_FOLDER_HELP} />
            </Group>
          ) : null}
          <Button
            variant="default"
            leftSection={<IconFolderPlus size={16} />}
            onClick={openCreateFolder}
          >
            New folder
          </Button>
          <Button
            leftSection={<IconUpload size={16} />}
            onClick={() => setShowDropzone((visible) => !visible)}
          >
            Upload
          </Button>
        </Group>
      </Group>

      <Breadcrumbs mb="md">
        {path.length === 0 ? (
          <Text size="sm" fw={600}>
            Library
          </Text>
        ) : (
          <Anchor component="button" type="button" size="sm" onClick={() => setPath([])}>
            Library
          </Anchor>
        )}
        {path.map((folder, index) =>
          index === path.length - 1 ? (
            <Text key={folder.id} size="sm" fw={600}>
              {folder.name}
            </Text>
          ) : (
            <Anchor
              key={folder.id}
              component="button"
              type="button"
              size="sm"
              onClick={() => setPath(path.slice(0, index + 1))}
            >
              {folder.name}
            </Anchor>
          ),
        )}
      </Breadcrumbs>

      {showDropzone ? (
        <Card withBorder mb="md" padding="md">
          <Dropzone
            onDrop={(dropped) => void handleDrop(dropped)}
            onReject={handleReject}
            loading={uploading}
            maxSize={MAX_UPLOAD_BYTES}
          >
            <Stack align="center" gap={4} py="md" style={{ pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <IconUpload size={32} stroke={1.5} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={32} stroke={1.5} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconPhoto size={32} stroke={1.5} color="var(--mantine-color-slate-4)" />
              </Dropzone.Idle>
              <Text fw={500}>Drag files here or click to browse</Text>
              <Text size="xs" c="slate.5">
                Up to 25 MB per file
              </Text>
            </Stack>
          </Dropzone>
          {atRoot && site ? (
            <Text size="xs" c="slate.5" mt="xs">
              Files uploaded here go to the &quot;{site.name}&quot; site folder
              <HelpTip label={SITE_FOLDER_HELP} />
            </Text>
          ) : null}
        </Card>
      ) : null}

      {initialLoading ? (
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}>
          {SKELETON_CARDS.map((card) => (
            <Skeleton key={card} height={140} radius="md" />
          ))}
        </SimpleGrid>
      ) : libraryEmpty ? (
        <Card padding={0}>
          <Stack align="center" gap="sm" py={56} px="md">
            <ThemeIcon size={44} radius="md" variant="light">
              <IconPhoto size={24} stroke={1.7} />
            </ThemeIcon>
            <Text c="slate.5" ta="center" maw={440}>
              {atRoot
                ? 'The media library stores the images and documents you use on your pages. Upload files once, organize them in folders, and reuse them anywhere.'
                : 'This folder is empty. Upload files into it or create a subfolder.'}
            </Text>
            <Button leftSection={<IconUpload size={16} />} onClick={() => setShowDropzone(true)}>
              Upload files
            </Button>
          </Stack>
        </Card>
      ) : (
        <Stack gap="lg">
          {folders.length > 0 ? (
            <div>
              <Text size="sm" fw={600} c="slate.5" mb="xs">
                Folders
              </Text>
              <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }}>
                {folders.map((folder) => (
                  <Card key={folder.id} withBorder padding="sm">
                    <Group justify="space-between" wrap="nowrap">
                      <UnstyledButton
                        onClick={() => setPath([...path, folder])}
                        style={{ flex: 1, minWidth: 0 }}
                        aria-label={`Open ${folder.name}`}
                      >
                        <Group gap="xs" wrap="nowrap">
                          <IconFolder
                            size={20}
                            stroke={1.7}
                            color="var(--mantine-color-neriva-6)"
                          />
                          <Text fw={500} size="sm" truncate>
                            {folder.name}
                          </Text>
                          {folder.siteId ? (
                            <Badge size="xs" variant="light" color="gray">
                              Site
                            </Badge>
                          ) : null}
                        </Group>
                      </UnstyledButton>
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            color="slate"
                            aria-label={`Actions for ${folder.name}`}
                          >
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconPencil size={14} />}
                            onClick={() => openRenameFolder(folder)}
                          >
                            Rename
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => confirmDeleteFolder(folder)}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            </div>
          ) : null}

          {files.length > 0 || filesLoading ? (
            <div>
              <Text size="sm" fw={600} c="slate.5" mb="xs">
                Files
              </Text>
              <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}>
                {files.map((file) => {
                  const TypeIcon = fileTypeIcon(file.contentType);
                  return (
                    <Card
                      key={file.id}
                      withBorder
                      padding="xs"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedFile(file)}
                      aria-label={`Open details for ${file.fileName}`}
                    >
                      <Card.Section>
                        <AspectRatio ratio={4 / 3}>
                          {isImage(file.contentType) ? (
                            <Image
                              src={apiUrl(file.url)}
                              alt={file.alt ?? file.fileName}
                              fit="cover"
                            />
                          ) : (
                            <Stack
                              align="center"
                              justify="center"
                              gap={4}
                              bg="var(--mantine-color-slate-0)"
                            >
                              <TypeIcon
                                size={30}
                                stroke={1.5}
                                color="var(--mantine-color-slate-4)"
                              />
                              <Badge color="gray" variant="light" size="xs">
                                {fileExtension(file.fileName)}
                              </Badge>
                            </Stack>
                          )}
                        </AspectRatio>
                      </Card.Section>
                      <Text size="sm" fw={500} truncate mt="xs">
                        {file.fileName}
                      </Text>
                      <Text size="xs" c="slate.5">
                        {formatBytes(file.sizeBytes)}
                      </Text>
                    </Card>
                  );
                })}
                {filesLoading && files.length === 0
                  ? SKELETON_CARDS.map((card) => <Skeleton key={card} height={140} radius="md" />)
                  : null}
              </SimpleGrid>
              {hasMore ? (
                <Group justify="center" mt="md">
                  <Button variant="light" loading={filesLoading} onClick={() => void loadMore()}>
                    Load more
                  </Button>
                </Group>
              ) : null}
            </div>
          ) : null}
        </Stack>
      )}

      <Modal
        opened={folderModal !== null}
        onClose={() => setFolderModal(null)}
        title={folderModal?.mode === 'rename' ? 'Rename folder' : 'New folder'}
      >
        <form onSubmit={folderForm.onSubmit((values) => void handleFolderSubmit(values))}>
          <TextInput
            label="Name"
            placeholder="e.g. Product photos"
            data-autofocus
            {...folderForm.getInputProps('name')}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="slate" onClick={() => setFolderModal(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={folderSaving}>
              {folderModal?.mode === 'rename' ? 'Rename' : 'Create folder'}
            </Button>
          </Group>
        </form>
      </Modal>

      <FileDrawer
        file={selectedFile}
        opened={selectedFile !== null}
        onClose={() => setSelectedFile(null)}
        onChanged={onFileChanged}
      />
    </>
  );
}
