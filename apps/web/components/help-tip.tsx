'use client';

import { Tooltip } from '@mantine/core';
import { IconHelpCircle } from '@tabler/icons-react';

// The (?) affordance: hover explains what a field or concept means.
// Use next to any label a lay user might not know.
export function HelpTip({ label }: { label: string }) {
  return (
    <Tooltip label={label} events={{ hover: true, focus: true, touch: true }}>
      <IconHelpCircle
        size={15}
        stroke={1.8}
        style={{
          color: 'var(--mantine-color-slate-4)',
          verticalAlign: 'text-bottom',
          cursor: 'help',
          marginLeft: 4,
        }}
        aria-label={label}
      />
    </Tooltip>
  );
}
