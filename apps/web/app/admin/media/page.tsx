'use client';

import '@mantine/dropzone/styles.css';

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
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
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconDots,
  IconFolder,
  IconFolderPlus,
  IconFolderSymlink,
  IconPencil,
  IconPhoto,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
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

// Drag-and-drop payloads (spec 11 addendum): a folder card is both a drag
// source and a drop target; a file card is a drag source only. null
// folderId means the root of the library.
interface DragItem {
  kind: 'file' | 'folder';
  id: string;
  name: string;
  currentFolderId?: string | null;
  currentParentId?: string | null;
}

interface DropTarget {
  folderId: string | null;
}

// Wraps a folder card so it can be dragged onto another folder and can also
// receive a dropped file or folder. A ring highlights it while something is
// dragged over it.
function DraggableFolderCard({ folder, children }: { folder: MediaFolder; children: ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag-folder-${folder.id}`,
    data: {
      kind: 'folder',
      id: folder.id,
      name: folder.name,
      currentParentId: folder.parentId,
    } satisfies DragItem,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-folder-${folder.id}`,
    data: { folderId: folder.id } satisfies DropTarget,
  });
  return (
    <div
      ref={(element) => {
        setDragRef(element);
        setDropRef(element);
      }}
      {...attributes}
      {...listeners}
      style={{
        opacity: isDragging ? 0.4 : 1,
        outline: isOver ? '2px solid var(--mantine-color-neriva-6)' : undefined,
        borderRadius: 8,
      }}
    >
      {children}
    </div>
  );
}

// Wraps a file card so it can be dragged onto a folder card or a breadcrumb.
function DraggableFileCard({ file, children }: { file: MediaFile; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag-file-${file.id}`,
    data: {
      kind: 'file',
      id: file.id,
      name: file.fileName,
      currentFolderId: file.folderId,
    } satisfies DragItem,
  });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ opacity: isDragging ? 0.4 : 1 }}>
      {children}
    </div>
  );
}

// A breadcrumb segment as a drop target, so a card can be dragged up to any
// ancestor folder (or the library root) without navigating there first.
function DroppableCrumb({ folderId, children }: { folderId: string | null; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-crumb-${folderId ?? 'root'}`,
    data: { folderId } satisfies DropTarget,
  });
  return (
    <span
      ref={setNodeRef}
      style={{
        borderRadius: 6,
        padding: isOver ? '2px 6px' : undefined,
        outline: isOver ? '2px solid var(--mantine-color-neriva-6)' : undefined,
      }}
    >
      {children}
    </span>
  );
}

export default function MediaLibraryPage() {
  const { current: site } = useSite();

  // Breadcrumb path from the root; the current folder is the last entry.
  const [path, setPath] = useState<MediaFolder[]>([]);
  const currentFolder = path.at(-1) ?? null;
  const folderKey = currentFolder?.id ?? 'root';

  // A search term looks across every folder in the tenant, so the folder
  // grid (scoped to the current directory) is hidden while one is active.
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const searching = debouncedSearch.trim() !== '';

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

  const filesPath = searching
    ? `/media/files?search=${encodeURIComponent(debouncedSearch.trim())}`
    : `/media/files?folder=${folderKey}`;
  const {
    items: files,
    loading: filesLoading,
    hasMore,
    refresh: refreshFiles,
    loadMore,
  } = useCursorList<MediaFile>(filesPath, (error) =>
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

  // Drag a file or folder card onto a folder card or a breadcrumb to move
  // it there. A small activation distance keeps plain clicks (open folder,
  // open file details) working.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const dragged = event.active.data.current as DragItem | undefined;
    const target = event.over?.data.current as DropTarget | undefined;
    if (!dragged || !target) {
      return;
    }
    if (dragged.kind === 'folder' && dragged.id === target.folderId) {
      return; // Dropped onto itself: no-op.
    }
    try {
      if (dragged.kind === 'file') {
        if (dragged.currentFolderId === target.folderId) {
          return;
        }
        await api.patch(`/media/files/${dragged.id}`, { folderId: target.folderId });
      } else {
        if (dragged.currentParentId === target.folderId) {
          return;
        }
        await api.patch(`/media/folders/${dragged.id}`, { parent: target.folderId });
      }
      notifications.show({ color: 'green', message: `Moved "${dragged.name}".` });
      await Promise.all([loadFolders(), refreshFiles()]);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not move',
        message: error instanceof ApiError ? error.message : `Failed to move "${dragged.name}".`,
      });
    }
  }

  const initialLoading = foldersLoading && filesLoading && files.length === 0;
  const libraryEmpty =
    !searching && !foldersLoading && !filesLoading && folders.length === 0 && files.length === 0;
  const noSearchResults = searching && !filesLoading && files.length === 0;

  return (
    <DndContext sensors={dndSensors} onDragEnd={(event) => void handleDragEnd(event)}>
      <Group justify="space-between" mb="lg" align="flex-start">
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
          <TextInput
            placeholder="Search files by name"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            rightSection={
              search !== '' ? (
                <ActionIcon
                  variant="subtle"
                  color="slate"
                  size="sm"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : null
            }
            w={240}
          />
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
        <DroppableCrumb folderId={null}>
          {path.length === 0 ? (
            <Text size="sm" fw={600}>
              Library
            </Text>
          ) : (
            <Anchor component="button" type="button" size="sm" onClick={() => setPath([])}>
              Library
            </Anchor>
          )}
        </DroppableCrumb>
        {path.map((folder, index) =>
          index === path.length - 1 ? (
            <DroppableCrumb key={folder.id} folderId={folder.id}>
              <Text size="sm" fw={600}>
                {folder.name}
              </Text>
            </DroppableCrumb>
          ) : (
            <DroppableCrumb key={folder.id} folderId={folder.id}>
              <Anchor
                component="button"
                type="button"
                size="sm"
                onClick={() => setPath(path.slice(0, index + 1))}
              >
                {folder.name}
              </Anchor>
            </DroppableCrumb>
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
      ) : noSearchResults ? (
        <Card padding={0}>
          <Stack align="center" gap="sm" py={56} px="md">
            <ThemeIcon size={44} radius="md" variant="light">
              <IconSearch size={24} stroke={1.7} />
            </ThemeIcon>
            <Text c="slate.5" ta="center" maw={440}>
              No files match &quot;{debouncedSearch.trim()}&quot;. Search looks across every folder
              by file name.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Stack gap="lg">
          {!searching && folders.length > 0 ? (
            <div>
              <Text size="sm" fw={600} c="slate.5" mb="xs">
                Folders
              </Text>
              <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }}>
                {folders.map((folder) => (
                  <DraggableFolderCard key={folder.id} folder={folder}>
                    <Card withBorder padding="sm">
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
                  </DraggableFolderCard>
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
                  const card = (
                    <Card
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
                  return searching ? (
                    <div key={file.id}>{card}</div>
                  ) : (
                    <DraggableFileCard key={file.id} file={file}>
                      {card}
                    </DraggableFileCard>
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
    </DndContext>
  );
}
