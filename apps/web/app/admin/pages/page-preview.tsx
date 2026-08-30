'use client';

import { ActionIcon, Button, Center, Group, SegmentedControl, Text, Tooltip } from '@mantine/core';
import { scopeSiteCss, SITE_CSS_SCOPE_CLASS } from '../../../lib/renderer/scope-css';
import {
  IconArrowLeft,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceTablet,
} from '@tabler/icons-react';
import { useState } from 'react';
import { type BlockInfo, RenderTree } from '../../../lib/renderer/render-tree';
import { type CanvasDevice } from './editor-canvas';
import classes from './studio.module.css';
import type { PageTree } from './tree-utils';
import { useSitePreviewData } from './use-site-preview-data';

const DEVICE_WIDTHS: Record<CanvasDevice, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

// A true "how will this look" preview: it renders the in-memory (possibly
// unsaved) tree through the exact same RenderTree the public site uses, with
// the site's real stylesheet and page list, inside .nv-site-root so the
// header's light/dark toggle behaves identically to production. No editing
// chrome (selection frames, toolbars, add-block affordances) is mounted at
// all, rather than hidden, so this can never leak editing controls.
export function PagePreview({
  title,
  siteSlug,
  tree,
  blockInfo,
  onExit,
}: {
  title: string;
  siteSlug: string | null;
  tree: PageTree;
  blockInfo: Record<string, BlockInfo>;
  onExit: () => void;
}) {
  const [device, setDevice] = useState<CanvasDevice>('desktop');
  const { css, sitePages } = useSitePreviewData(siteSlug);

  return (
    <div className={classes.studio}>
      <div className={classes.topBar}>
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Tooltip label="Exit preview">
            <ActionIcon
              variant="subtle"
              color="slate"
              onClick={onExit}
              aria-label="Exit preview and go back to editing"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Text fw={600} truncate c={title.trim() === '' ? 'slate.4' : undefined}>
            {title.trim() === '' ? 'Untitled page' : title}
          </Text>
          <Text size="xs" c="slate.5" style={{ flexShrink: 0 }}>
            Preview · includes unsaved changes
          </Text>
        </Group>

        <SegmentedControl
          size="xs"
          value={device}
          onChange={(next) =>
            setDevice(next === 'tablet' ? 'tablet' : next === 'mobile' ? 'mobile' : 'desktop')
          }
          data={[
            {
              value: 'desktop',
              label: (
                <Center>
                  <IconDeviceDesktop size={15} aria-label="Desktop width" />
                </Center>
              ),
            },
            {
              value: 'tablet',
              label: (
                <Center>
                  <IconDeviceTablet size={15} aria-label="Tablet width" />
                </Center>
              ),
            },
            {
              value: 'mobile',
              label: (
                <Center>
                  <IconDeviceMobile size={15} aria-label="Mobile width" />
                </Center>
              ),
            },
          ]}
        />

        <Group gap="xs" wrap="nowrap" justify="flex-end" style={{ flex: 1 }}>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconArrowLeft size={15} />}
            onClick={onExit}
          >
            Exit preview
          </Button>
        </Group>
      </div>

      <div className={classes.canvasScroll}>
        <div
          className={`${classes.pageSurface} ${SITE_CSS_SCOPE_CLASS} nv-site-root`}
          // See editor-canvas: the token stylesheet's prefers-color-scheme
          // block must not leak the editor's OS theme into the preview.
          data-nv-theme="light"
          style={{ maxWidth: DEVICE_WIDTHS[device] }}
        >
          {css !== '' ? <style>{scopeSiteCss(css)}</style> : null}
          <RenderTree
            tree={tree}
            blockInfo={blockInfo}
            sitePages={sitePages}
            siteSlug={siteSlug ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}
