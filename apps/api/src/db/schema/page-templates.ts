import {
  foreignKey,
  jsonb,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { envelopeColumns } from './envelope';
import type { PageTree } from './pages';
import { sites } from './sites';
import { tenants } from './tenants';

// MASTER: header/footer chrome every page renders inside, via the reserved
// drop-zone node. STANDARD: a pre-filled starting point copied into a new
// page's tree once, with no ongoing link (spec 14).
export const pageTemplateKind = pgEnum('page_template_kind', ['MASTER', 'STANDARD']);
export type PageTemplateKind = (typeof pageTemplateKind.enumValues)[number];

// Reduced envelope (spec 14): no status (templates are not a publication
// lifecycle, they are live the moment they validate), no customFields.
export const pageTemplates = pgTable(
  'page_templates',
  {
    ...envelopeColumns,
    name: varchar('name', { length: 255 }).notNull(),
    kind: pageTemplateKind('kind').notNull(),
    // null = available to every site; set = offered only for that site.
    siteId: uuid('site_id'),
    tree: jsonb('tree').$type<PageTree>().notNull().default({ blocks: [] }),
  },
  (t) => [
    uniqueIndex('page_templates_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    uniqueIndex('page_templates_tenant_name_uq').on(t.tenantId, t.name),
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'page_templates_tenant_fk',
    }),
    foreignKey({
      columns: [t.siteId],
      foreignColumns: [sites.id],
      name: 'page_templates_site_fk',
    }).onDelete('set null'),
  ],
);
