import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { envelopeColumns, statusColumn } from './envelope';
import { tenants } from './tenants';
import { resourceFolders } from './resource-folders';

export interface BlockSlot {
  name: string;
  allowedBlocks?: string[];
}

export const BLOCK_TEMPLATE_SOURCES = ['NATIVE', 'CUSTOM'] as const;
export type BlockTemplateSource = (typeof BLOCK_TEMPLATE_SOURCES)[number];

export const blocks = pgTable(
  'blocks',
  {
    ...envelopeColumns,
    ...statusColumn,
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }),
    description: text('description'),
    propsSchema: jsonb('props_schema').$type<Record<string, unknown>>().notNull(),
    slots: jsonb('slots').$type<BlockSlot[]>().notNull().default([]),
    // The active source consumed by the renderer. Native rows additionally
    // keep an immutable baseline so a user customization can be restored.
    html: text('html'),
    css: text('css'),
    // JavaScript is executed only inside the renderer's sandboxed iframe.
    // It never executes in the admin or public page document directly.
    js: text('js'),
    nativeHtml: text('native_html'),
    nativeCss: text('native_css'),
    nativeJs: text('native_js'),
    templateSource: varchar('template_source', { length: 16 })
      .$type<BlockTemplateSource>()
      .notNull()
      .default('CUSTOM'),
    folderId: uuid('folder_id').references(() => resourceFolders.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('blocks_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    index('blocks_tenant_folder_id_idx').on(t.tenantId, t.folderId, t.id),
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'blocks_tenant_fk' }),
  ],
);
