import { foreignKey, jsonb, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { customFieldsColumn, envelopeColumns, statusColumn } from './envelope';
import { sites } from './sites';
import { tenants } from './tenants';

// Recursive tree of Block instances (spec 03-pages). `block` is the block's
// externalReferenceCode; `slots` maps declared slot names to child nodes.
// `styles` holds per-instance presentation values from the spec 12 whitelist
// (raw CSS values or token:<name> references resolved by the renderer).
export interface PageTreeNode {
  block: string;
  props?: Record<string, unknown>;
  slots?: Record<string, PageTreeNode[]>;
  styles?: Record<string, string>;
}

export interface PageTree {
  blocks: PageTreeNode[];
}

export const pages = pgTable(
  'pages',
  {
    ...envelopeColumns,
    ...statusColumn,
    ...customFieldsColumn,
    siteId: uuid('site_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    path: varchar('path', { length: 255 }).notNull(),
    tree: jsonb('tree').$type<PageTree>().notNull().default({ blocks: [] }),
  },
  (t) => [
    uniqueIndex('pages_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    uniqueIndex('pages_site_path_uq').on(t.siteId, t.path),
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'pages_tenant_fk' }),
    foreignKey({
      columns: [t.siteId],
      foreignColumns: [sites.id],
      name: 'pages_site_fk',
    }).onDelete('cascade'),
  ],
);
