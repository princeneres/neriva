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

// Friendly names and plain-language descriptions for the field type Select.
export const FIELD_TYPE_META: Record<ContentField['type'], { label: string; description: string }> =
  {
    text: { label: 'Text', description: 'A short, single line of text' },
    richtext: {
      label: 'Rich text',
      description: 'Longer text content. Stored as plain text in v1.',
    },
    number: { label: 'Number', description: 'A numeric value, like a price or a count' },
    boolean: { label: 'Yes/No', description: 'A simple on or off choice' },
    date: { label: 'Date', description: 'A calendar date' },
  };

export const FIELD_TYPE_OPTIONS = (Object.keys(FIELD_TYPE_META) as ContentField['type'][]).map(
  (value) => ({ value, label: FIELD_TYPE_META[value].label }),
);

export const STATUS_COLORS: Record<ContentEntry['status'], string> = {
  DRAFT: 'gray',
  PUBLISHED: 'green',
  ARCHIVED: 'dark',
};

export const CONTENT_TYPE_HELP =
  'A template for entries: define the fields once, fill them per entry';
