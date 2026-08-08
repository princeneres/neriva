import type { components } from '@neriva/contracts';

export type ContentField = components['schemas']['ContentFieldDto'];

// The generator types nullable columns as objects (OpenAPI "type: [x, null]"
// quirk); at runtime the API returns plain strings (spec 04). Refine locally.
export type ContentType = Omit<components['schemas']['ContentTypeDto'], 'description'> & {
  description: string | null;
};

export type ContentEntry = Omit<components['schemas']['ContentEntryDto'], 'siteId'> & {
  siteId: string | null;
};
