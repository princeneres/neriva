import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface ListBody<T> {
  data: T[];
  meta: { cursor: string | null; limit: number };
}

interface Named {
  id: string;
  name: string;
}

interface Titled {
  id: string;
  title: string;
}

const PAGE_TITLES = [
  'Home',
  'Notícias da Empresa',
  'Sobre Nós',
  'Serviços Oferecidos',
  'Trabalhe Conosco',
  'Política de Privacidade',
  'Termos de Uso',
  'Perguntas Frequentes',
  'Depoimentos de Clientes',
  'Nossa Equipe',
  'Blog Corporativo',
  'Página de Contato',
  'Mapa do Site',
  'Área do Cliente',
];

// Entries whose searchable words live only in the values payload, never in the
// title, so a hit proves the payload was searched.
const ENTRY_FIXTURES: { title: string; summary: string; body: string }[] = [
  {
    title: 'Balanço do Primeiro Trimestre',
    summary: 'Resultados consolidados',
    body: 'A nossa agência brasileira fechou o trimestre com crescimento.',
  },
  {
    title: 'Nova Sede',
    summary: 'Mudança de endereço',
    body: 'Inauguramos o escritório na avenida Paulista.',
  },
  {
    title: 'Parceria Comercial',
    summary: 'Acordo assinado',
    body: 'Firmamos contrato com novos fornecedores de matéria prima.',
  },
  {
    title: 'Manutenção Programada',
    summary: 'Aviso aos clientes',
    body: 'O sistema ficará indisponível no sábado pela manhã.',
  },
];

describe('search (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let siteId: string;
  let contentTypeId: string;
  let objectDefinitionId: string;

  async function loginFresh(
    email: string,
    tempPassword: string,
    newPassword: string,
  ): Promise<string> {
    const first = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: tempPassword },
    });
    expect(first.statusCode).toBe(200);
    const change = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: {
        authorization: `Bearer ${(first.json() as { data: Tokens }).data.accessToken}`,
      },
      payload: { currentPassword: tempPassword, newPassword },
    });
    expect(change.statusCode).toBe(200);
    return (change.json() as { data: Tokens }).data.accessToken;
  }

  async function get<T>(url: string): Promise<ListBody<T>> {
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as ListBody<T>;
  }

  async function post(url: string, payload: Record<string, unknown>): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url,
      headers: { authorization: `Bearer ${adminToken}` },
      payload,
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { data: { id: string } }).data.id;
  }

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');

    siteId = await post('/sites', {
      name: 'Site de Busca',
      slug: 'busca',
      externalReferenceCode: 'search-site',
    });

    for (const [index, title] of PAGE_TITLES.entries()) {
      await post(`/sites/${siteId}/pages`, { title, path: `/p-${index}` });
    }

    await post('/blocks', {
      name: 'Cabeçalho Padrão',
      externalReferenceCode: 'search-header',
      category: 'layout',
      description: 'Barra superior com navegação',
      propsSchema: { type: 'object', properties: {} },
    });
    await post('/blocks', {
      name: 'Galeria de Imagens',
      externalReferenceCode: 'search-gallery',
      category: 'media',
      propsSchema: { type: 'object', properties: {} },
    });

    contentTypeId = await post('/content-types', {
      name: 'Notícia',
      externalReferenceCode: 'search-article',
      fields: [
        { key: 'summary', label: 'Resumo', type: 'text', required: false },
        { key: 'body', label: 'Corpo', type: 'richtext', required: false },
      ],
    });
    for (const entry of ENTRY_FIXTURES) {
      await post('/content-entries', {
        contentType: contentTypeId,
        site: siteId,
        title: entry.title,
        values: { summary: entry.summary, body: entry.body },
      });
    }

    objectDefinitionId = await post('/object-definitions', {
      name: 'Fornecedor',
      pluralName: 'Fornecedores',
      externalReferenceCode: 'search-supplier',
      description: 'Cadastro de fornecedores',
      fields: [
        { key: 'razaoSocial', label: 'Razão social', type: 'text', required: true },
        { key: 'cidade', label: 'Cidade', type: 'text', required: false },
      ],
    });
    for (const record of [
      { razaoSocial: 'Padaria São José', cidade: 'Belo Horizonte' },
      { razaoSocial: 'Gráfica Modelo', cidade: 'Curitiba' },
      { razaoSocial: 'Transportadora Veloz', cidade: 'Salvador' },
    ]) {
      await post(`/object-definitions/${objectDefinitionId}/records`, { data: record });
    }
  });

  afterAll(async () => {
    await app?.close();
    await testDb?.stop();
  });

  describe('migration objects', () => {
    it('installs the extensions and the search helpers', async () => {
      const extensions = await testDb.db.execute<{ extname: string }>(
        sql`SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent')`,
      );
      expect(extensions.rows.map((row) => row.extname).sort()).toEqual(['pg_trgm', 'unaccent']);

      const functions = await testDb.db.execute<{ proname: string }>(
        sql`SELECT proname FROM pg_proc WHERE proname LIKE 'nv_search%'`,
      );
      expect(functions.rows.map((row) => row.proname).sort()).toEqual([
        'nv_search_doc',
        'nv_search_text',
        'nv_search_tsv',
      ]);
    });

    it('folds accents and case in nv_search_text', async () => {
      const result = await testDb.db.execute<{ folded: string }>(
        sql`SELECT nv_search_text('Página de AÇÃO') AS folded`,
      );
      expect(result.rows[0]?.folded).toBe('pagina de acao');
    });

    // Stored on the database rather than read from this connection: the
    // setting only reaches sessions opened after the migration, and this pool
    // predates it. The pool the app opens on boot does pick it up, which the
    // typo test below exercises through the HTTP layer.
    it('loosens the trigram word similarity threshold for the whole database', async () => {
      const setting = await testDb.db.execute<{ setconfig: string[] | null }>(
        sql`SELECT s.setconfig
            FROM pg_db_role_setting s
            JOIN pg_database d ON d.oid = s.setdatabase
            WHERE d.datname = current_database()`,
      );
      expect(setting.rows[0]?.setconfig).toContain('pg_trgm.word_similarity_threshold=0.5');
    });

    it('creates every search index', async () => {
      const indexes = await testDb.db.execute<{ indexname: string }>(
        sql`SELECT indexname FROM pg_indexes WHERE indexname LIKE '%\\_search\\_idx' OR indexname LIKE '%\\_fts\\_idx'`,
      );
      expect(indexes.rows.map((row) => row.indexname).sort()).toEqual([
        'blocks_search_idx',
        'content_entries_fts_idx',
        'content_entries_search_idx',
        'object_records_fts_idx',
        'pages_search_idx',
        'users_search_idx',
      ]);
    });
  });

  describe('pages (trigram)', () => {
    it('finds a page that the first listing page does not contain', async () => {
      const firstPage = await get<Titled>(`/sites/${siteId}/pages?limit=5`);
      expect(firstPage.data.map((page) => page.title)).not.toContain('Página de Contato');

      const found = await get<Titled>(`/sites/${siteId}/pages?limit=5&search=contato`);
      expect(found.data.map((page) => page.title)).toEqual(['Página de Contato']);
    });

    it('ignores accents in both directions', async () => {
      const unaccented = await get<Titled>(`/sites/${siteId}/pages?search=noticias`);
      expect(unaccented.data.map((page) => page.title)).toEqual(['Notícias da Empresa']);

      const accented = await get<Titled>(`/sites/${siteId}/pages?search=SERVIÇOS`);
      expect(accented.data.map((page) => page.title)).toEqual(['Serviços Oferecidos']);
    });

    it('tolerates a typo through trigram word similarity', async () => {
      const found = await get<Titled>(`/sites/${siteId}/pages?search=depoimeto`);
      expect(found.data.map((page) => page.title)).toEqual(['Depoimentos de Clientes']);
    });

    it('tolerates a dropped letter in a short accented word', async () => {
      const found = await get<Titled>(`/sites/${siteId}/pages?search=pagna`);
      expect(found.data.map((page) => page.title)).toContain('Página de Contato');
    });

    it('returns an empty page when nothing matches', async () => {
      const missing = await get<Titled>(`/sites/${siteId}/pages?search=xyzinexistente`);
      expect(missing.data).toEqual([]);
      expect(missing.meta.cursor).toBeNull();
    });

    it('treats a blank term as no filter at all', async () => {
      const blank = await get<Titled>(`/sites/${siteId}/pages?limit=100&search=%20%20`);
      expect(blank.data).toHaveLength(PAGE_TITLES.length);
    });

    it('walks every match across cursor pages without skipping or repeating', async () => {
      const all = await get<Titled>(`/sites/${siteId}/pages?limit=100&search=de`);
      expect(all.data.length).toBeGreaterThan(2);
      const expected = all.data.map((page) => page.id);

      const walked: string[] = [];
      let cursor: string | null = null;
      for (let request = 0; request < 20; request += 1) {
        const query: string = cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`;
        const page: ListBody<Titled> = await get<Titled>(
          `/sites/${siteId}/pages?limit=2&search=de${query}`,
        );
        expect(page.data.length).toBeLessThanOrEqual(2);
        walked.push(...page.data.map((row) => row.id));
        cursor = page.meta.cursor;
        if (cursor === null) {
          break;
        }
      }
      expect(cursor).toBeNull();
      expect(walked).toEqual(expected);
      expect(new Set(walked).size).toBe(walked.length);
    });

    it('rejects a term longer than the DTO allows', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/sites/${siteId}/pages?search=${'a'.repeat(201)}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('does not let a wildcard in the term match everything', async () => {
      const wildcard = await get<Titled>(`/sites/${siteId}/pages?limit=100&search=%25`);
      expect(wildcard.data).toEqual([]);
    });
  });

  describe('blocks (trigram)', () => {
    it('searches name, category and description', async () => {
      const byName = await get<Named>('/blocks?search=galeria');
      expect(byName.data.map((block) => block.name)).toEqual(['Galeria de Imagens']);

      const byDescription = await get<Named>('/blocks?search=navegacao');
      expect(byDescription.data.map((block) => block.name)).toEqual(['Cabeçalho Padrão']);
    });

    it('combines the search with the status filter', async () => {
      const drafts = await get<Named>('/blocks?status=DRAFT&search=cabecalho');
      expect(drafts.data.map((block) => block.name)).toEqual(['Cabeçalho Padrão']);

      const published = await get<Named>('/blocks?status=PUBLISHED&search=cabecalho');
      expect(published.data).toEqual([]);
    });
  });

  describe('content entries (full text)', () => {
    it('matches a word that only exists inside the values payload', async () => {
      const found = await get<Titled>(`/content-entries?site=${siteId}&search=agencia`);
      expect(found.data.map((entry) => entry.title)).toEqual(['Balanço do Primeiro Trimestre']);
    });

    it('stems Portuguese words', async () => {
      const found = await get<Titled>(`/content-entries?site=${siteId}&search=fornecedor`);
      expect(found.data.map((entry) => entry.title)).toEqual(['Parceria Comercial']);
    });

    it('ANDs multiple words and honours a quoted phrase', async () => {
      const both = await get<Titled>(
        `/content-entries?site=${siteId}&search=${encodeURIComponent('escritorio paulista')}`,
      );
      expect(both.data.map((entry) => entry.title)).toEqual(['Nova Sede']);

      const phrase = await get<Titled>(
        `/content-entries?site=${siteId}&search=${encodeURIComponent('"avenida paulista"')}`,
      );
      expect(phrase.data.map((entry) => entry.title)).toEqual(['Nova Sede']);

      const missingPhrase = await get<Titled>(
        `/content-entries?site=${siteId}&search=${encodeURIComponent('"paulista avenida"')}`,
      );
      expect(missingPhrase.data).toEqual([]);
    });

    it('falls back to a trigram match on the title', async () => {
      const found = await get<Titled>(`/content-entries?site=${siteId}&search=balanco`);
      expect(found.data.map((entry) => entry.title)).toEqual(['Balanço do Primeiro Trimestre']);
    });

    it('keeps cursor pagination correct while filtering', async () => {
      const all = await get<Titled>(`/content-entries?site=${siteId}&limit=100&search=clientes`);
      const firstOfTwo = await get<Titled>(
        `/content-entries?site=${siteId}&limit=1&search=clientes`,
      );
      expect(firstOfTwo.data).toHaveLength(1);
      expect(firstOfTwo.data[0]?.id).toBe(all.data[0]?.id);
    });

    it('returns nothing for a term nobody wrote', async () => {
      const missing = await get<Titled>(`/content-entries?site=${siteId}&search=xyzinexistente`);
      expect(missing.data).toEqual([]);
    });
  });

  describe('object records (full text)', () => {
    it('matches a value inside the record payload, accents ignored', async () => {
      const found = await get<{ id: string; data: Record<string, unknown> }>(
        `/object-definitions/${objectDefinitionId}/records?search=grafica`,
      );
      expect(found.data.map((row) => row.data.razaoSocial)).toEqual(['Gráfica Modelo']);
    });

    it('returns nothing for an unknown term', async () => {
      const missing = await get<{ id: string }>(
        `/object-definitions/${objectDefinitionId}/records?search=xyzinexistente`,
      );
      expect(missing.data).toEqual([]);
    });
  });

  describe('metadata listings (substring)', () => {
    it('searches sites', async () => {
      const found = await get<Named>('/sites?search=busca');
      expect(found.data.map((site) => site.name)).toEqual(['Site de Busca']);
    });

    it('searches content types without accents', async () => {
      const found = await get<Named>('/content-types?search=noticia');
      expect(found.data.map((type) => type.name)).toEqual(['Notícia']);
    });

    it('searches object definitions across name, plural name and description', async () => {
      const byPlural = await get<Named>('/object-definitions?search=fornecedores');
      expect(byPlural.data.map((definition) => definition.name)).toEqual(['Fornecedor']);

      const byDescription = await get<Named>('/object-definitions?search=cadastro');
      expect(byDescription.data.map((definition) => definition.name)).toEqual(['Fornecedor']);
    });

    it('searches roles, users and style books', async () => {
      const roles = await get<Named>('/roles?search=administrator');
      expect(roles.data.map((role) => role.name)).toContain('Administrator');

      const users = await get<{ id: string; email: string }>('/users?search=admin@neriva');
      expect(users.data.map((user) => user.email)).toEqual(['admin@neriva.com']);

      const styleBooks = await get<Named>('/style-books?search=zzznenhum');
      expect(styleBooks.data).toEqual([]);
    });
  });
});
