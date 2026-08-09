import {
  IconAlignLeft,
  IconClick,
  IconCode,
  IconColumns2,
  IconColumns3,
  IconCube,
  IconFileText,
  IconHeading,
  IconId,
  IconLayout,
  IconPhoto,
  IconSeparator,
  IconSlideshow,
  IconSpacingVertical,
  IconSquare,
  IconVideo,
  type Icon,
} from '@tabler/icons-react';

// Meaningful icons per block, so users recognize components at a glance
// (palette, blocks gallery). Match by ERC first, then category, then default.
const BY_ERC: Record<string, Icon> = {
  'nv-container': IconSquare,
  'nv-columns-2': IconColumns2,
  'nv-columns-3': IconColumns3,
  'nv-heading': IconHeading,
  'nv-paragraph': IconAlignLeft,
  'nv-button': IconClick,
  'nv-image': IconPhoto,
  'nv-card': IconId,
  'nv-separator': IconSeparator,
  'nv-spacer': IconSpacingVertical,
  'nv-video': IconVideo,
  'nv-html': IconCode,
  hero: IconSlideshow,
  'rich-text': IconAlignLeft,
  'two-columns': IconColumns2,
  image: IconPhoto,
};

const BY_CATEGORY: Record<string, Icon> = {
  layout: IconLayout,
  basic: IconCube,
  content: IconFileText,
  media: IconPhoto,
  advanced: IconCode,
};

export function blockIconFor(erc: string, category?: string | null): Icon {
  return BY_ERC[erc] ?? BY_CATEGORY[(category ?? '').toLowerCase()] ?? IconCube;
}
