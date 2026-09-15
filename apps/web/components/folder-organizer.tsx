'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NavLink,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconFolder, IconFolderPlus } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export type FolderResource = 'blocks' | 'content-types' | 'content-entries' | 'objects';

export interface Folder {
  id: string;
  name: string;
}

interface FolderState {
  folders: Folder[];
  assignments: Record<string, string>;
}

const EMPTY_STATE: FolderState = { folders: [], assignments: {} };
const NO_FOLDER = '__no_folder__';

const RESOURCE_ENDPOINTS: Record<FolderResource, string> = {
  blocks: '/blocks',
  'content-types': '/content-types',
  'content-entries': '/content-entries',
  objects: '/object-definitions',
};

export interface FolderItem {
  id: string;
  folderId?: string | null;
}

export function useFolderOrganization(resource: FolderResource, items: FolderItem[] = []) {
  const [state, setState] = useState<FolderState>(EMPTY_STATE);

  useEffect(() => {
    let active = true;
    api
      .get<{ data: Folder[] }>(`/resource-folders?resource=${resource}&limit=100`)
      .then(({ data }) => {
        if (active) setState((current) => ({ ...current, folders: data }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [resource]);

  useEffect(() => {
    const assignments: Record<string, string> = {};
    for (const item of items) {
      if (item.folderId) assignments[item.id] = item.folderId;
    }
    setState((current) => ({ ...current, assignments }));
  }, [items]);

  async function createFolder(name: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }
    const { data } = await api.post<{ data: Folder }>('/resource-folders', {
      name: trimmed,
      resource,
    });
    setState((current) => ({ ...current, folders: [...current.folders, data] }));
    return data.id;
  }

  async function assignItem(itemId: string, folderId: string | null) {
    const previous = state.assignments[itemId] ?? null;
    setState((current) => {
      const assignments = { ...current.assignments };
      if (folderId === null) {
        delete assignments[itemId];
      } else {
        assignments[itemId] = folderId;
      }
      return { ...current, assignments };
    });
    try {
      await api.patch(`${RESOURCE_ENDPOINTS[resource]}/${itemId}`, { folderId });
    } catch {
      setState((current) => {
        const assignments = { ...current.assignments };
        if (previous === null) delete assignments[itemId];
        else assignments[itemId] = previous;
        return { ...current, assignments };
      });
    }
  }

  function folderFor(itemId: string): string | null {
    return state.assignments[itemId] ?? null;
  }

  return { ...state, createFolder, assignItem, folderFor };
}

export function FolderPanel({
  folders,
  assignments,
  itemCount,
  selectedFolder,
  onSelect,
  onCreate,
}: {
  folders: Folder[];
  assignments: Record<string, string>;
  itemCount: number;
  selectedFolder: string | null;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string) => void;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [name, setName] = useState('');

  const countFor = (folderId: string) =>
    Object.values(assignments).filter((assigned) => assigned === folderId).length;

  function create() {
    if (name.trim()) {
      onCreate(name);
      setName('');
      close();
    }
  }

  return (
    <>
      <Card withBorder padding="sm" radius="md">
        <Group justify="space-between" mb={6}>
          <Group gap="xs">
            <IconFolder size={16} stroke={1.7} />
            <Text size="sm" fw={700}>
              Folders
            </Text>
          </Group>
          <Tooltip label="Create folder">
            <ActionIcon variant="subtle" color="neriva" onClick={open} aria-label="Create folder">
              <IconFolderPlus size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Stack gap={2}>
          <NavLink
            label="All items"
            leftSection={<IconFolder size={15} />}
            rightSection={
              <Badge size="xs" variant="light">
                {itemCount}
              </Badge>
            }
            active={selectedFolder === null}
            onClick={() => onSelect(null)}
            variant="light"
          />
          {folders.map((folder) => (
            <NavLink
              key={folder.id}
              label={folder.name}
              leftSection={<IconFolder size={15} />}
              rightSection={
                <Badge size="xs" variant="light">
                  {countFor(folder.id)}
                </Badge>
              }
              active={selectedFolder === folder.id}
              onClick={() => onSelect(folder.id)}
              variant="light"
            />
          ))}
        </Stack>
        <Text size="xs" c="slate.5" mt="sm">
          Shared folders keep this workspace organized for the whole team. Choose a folder on each
          item.
        </Text>
      </Card>

      <Modal opened={opened} onClose={close} title="Create folder" centered>
        <Stack>
          <Text size="sm" c="slate.5">
            Use folders to keep related items together, such as Marketing, Landing pages, or Data.
          </Text>
          <TextInput
            label="Folder name"
            placeholder="e.g. Marketing"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') create();
            }}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={close}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!name.trim()}>
              Create folder
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export function FolderPicker({
  value,
  folders,
  onChange,
}: {
  value: string | null;
  folders: Folder[];
  onChange: (folderId: string | null) => void;
}) {
  if (folders.length === 0) return null;
  return (
    <Select
      size="xs"
      aria-label="Folder"
      value={value ?? NO_FOLDER}
      onChange={(folderId) => onChange(folderId === NO_FOLDER ? null : folderId)}
      data={[
        { value: NO_FOLDER, label: 'No folder' },
        ...folders.map((folder) => ({ value: folder.id, label: folder.name })),
      ]}
      allowDeselect={false}
      w={132}
    />
  );
}
