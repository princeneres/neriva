import type { components } from '@neriva/contracts';

// The generated SiteDto types nullable text columns as objects (OpenAPI
// "type: [object, null]" quirk); at runtime the API returns plain strings
// (spec 01: description is nullable text). Refine locally for rendering.
export type Site = Omit<components['schemas']['SiteDto'], 'description'> & {
  description: string | null;
};
