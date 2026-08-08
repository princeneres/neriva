'use client';

import { Box, Card, Group, SimpleGrid, Text, ThemeIcon, Timeline, Title } from '@mantine/core';
import {
  IconArrowUpRight,
  IconCube,
  IconFilePlus,
  IconFileText,
  IconPalette,
  IconWorld,
} from '@tabler/icons-react';
import Link from 'next/link';
import { HelpTip } from '../../components/help-tip';

const QUICK_ACTIONS = [
  {
    title: 'Create a site',
    description: 'A site groups your pages under one address.',
    href: '/admin/sites',
    icon: IconWorld,
  },
  {
    title: 'Design a block',
    description: 'Blocks are the reusable pieces pages are made of.',
    href: '/admin/blocks',
    icon: IconCube,
  },
  {
    title: 'Build a page',
    description: 'Stack blocks, fill in their content, publish.',
    href: '/admin/pages',
    icon: IconFilePlus,
  },
  {
    title: 'Write content',
    description: 'Structured entries like articles or products.',
    href: '/admin/content',
    icon: IconFileText,
  },
];

export default function AdminHomePage() {
  return (
    <Box maw={960}>
      <Title order={1} fz="h2" mb={4}>
        Welcome to Neriva
      </Title>
      <Text c="slate.5" mb="xl">
        Your content, from first block to published page. A demo site is preloaded so you can
        explore how everything fits together.
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="xl">
        {QUICK_ACTIONS.map((action) => (
          <Card key={action.href} component={Link} href={action.href} padding="lg">
            <Group justify="space-between" mb="sm">
              <ThemeIcon size={38} radius="md" variant="light">
                <action.icon size={20} stroke={1.7} />
              </ThemeIcon>
              <IconArrowUpRight size={16} color="var(--mantine-color-slate-3)" />
            </Group>
            <Text fw={600} mb={2}>
              {action.title}
            </Text>
            <Text size="sm" c="slate.5">
              {action.description}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card padding="xl" maw={640}>
        <Group gap={6} mb="md">
          <Title order={3} fz="h4">
            How Neriva fits together
          </Title>
          <HelpTip label="The same flow works through the REST API: everything the admin does, an integration can do too." />
        </Group>
        <Timeline active={-1} bulletSize={26} lineWidth={2}>
          <Timeline.Item bullet={<IconWorld size={14} />} title="Sites hold everything">
            <Text size="sm" c="slate.5">
              Start with a site: it is the home of your pages and site-scoped content.
            </Text>
          </Timeline.Item>
          <Timeline.Item
            bullet={<IconCube size={14} />}
            title="Blocks define what a page can contain"
          >
            <Text size="sm" c="slate.5">
              A block declares its fields (a hero has a title, an image block has a URL). Like
              Liferay fragments, but typed.
            </Text>
          </Timeline.Item>
          <Timeline.Item bullet={<IconFilePlus size={14} />} title="Pages stack blocks">
            <Text size="sm" c="slate.5">
              Compose a page from blocks, fill their fields, and publish when ready.
            </Text>
          </Timeline.Item>
          <Timeline.Item
            bullet={<IconPalette size={14} />}
            title="The Style Book keeps it consistent"
          >
            <Text size="sm" c="slate.5">
              Colors, spacing and typography live in one versioned place that every block uses.
            </Text>
          </Timeline.Item>
        </Timeline>
      </Card>
    </Box>
  );
}
