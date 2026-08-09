import type { components } from '@neriva/contracts';
import type { PageTree } from './tree-utils';

// The generated DTOs type nullable text columns as objects (OpenAPI
// "type: [object, null]" quirk); at runtime the API returns plain strings.
// PageDto.tree is generated as an open object; the server validates it into
// the recursive shape from spec 03, so refine it locally for rendering.
export type Page = Omit<components['schemas']['PageDto'], 'tree' | 'masterPageTemplateId'> & {
  tree: PageTree;
  masterPageTemplateId: string | null;
};

export type PageTemplate = Omit<components['schemas']['PageTemplateDto'], 'tree'> & {
  tree: PageTree;
};

export type Block = Omit<components['schemas']['BlockDto'], 'category' | 'description'> & {
  category: string | null;
  description: string | null;
};

export type Site = Omit<components['schemas']['SiteDto'], 'description'> & {
  description: string | null;
};

export type EntityStatus = components['schemas']['PageDto']['status'];

// Badge colors from spec 09: DRAFT gray, PUBLISHED green, ARCHIVED dark.
export function statusColor(status: EntityStatus): string {
  switch (status) {
    case 'PUBLISHED':
      return 'green';
    case 'ARCHIVED':
      return 'dark';
    default:
      return 'gray';
  }
}
