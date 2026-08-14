import { describe, expect, it } from 'vitest';
import {
  buildPostListPath,
  entryFieldText,
  formatPostDate,
  hasPreviousPage,
  INITIAL_PAGER,
  nextPage,
  previousPage,
  resolveFieldKeys,
  resolvePageSize,
  type DeliveredEntry,
} from './post-list-data';

function entry(values: Record<string, unknown>): DeliveredEntry {
  return {
    id: 'id-1',
    externalReferenceCode: 'post-1',
    title: 'A post',
    contentType: 'article',
    values,
    updatedAt: '2026-01-05T00:00:00.000Z',
  };
}

describe('resolveFieldKeys', () => {
  it('falls back to the schema defaults when a prop is unset or blank', () => {
    expect(resolveFieldKeys({})).toEqual({
      summary: 'summary',
      body: 'body',
      date: 'publishedOn',
      image: 'thumbnail',
    });
    expect(resolveFieldKeys({ summaryField: '   ' }).summary).toBe('summary');
  });

  it('trims and honours an author-provided key', () => {
    expect(resolveFieldKeys({ imageField: ' cover ' }).image).toBe('cover');
  });
});

describe('resolvePageSize', () => {
  it('defaults and clamps to the schema bounds', () => {
    expect(resolvePageSize(undefined)).toBe(6);
    expect(resolvePageSize('4')).toBe(6);
    expect(resolvePageSize(0)).toBe(1);
    expect(resolvePageSize(99)).toBe(24);
    expect(resolvePageSize(4.7)).toBe(4);
  });
});

describe('entryFieldText', () => {
  it('reads a trimmed string and ignores everything else', () => {
    expect(entryFieldText(entry({ summary: '  hi  ' }), 'summary')).toBe('hi');
    expect(entryFieldText(entry({ summary: '' }), 'summary')).toBeNull();
    expect(entryFieldText(entry({ summary: 42 }), 'summary')).toBeNull();
    expect(entryFieldText(entry({}), 'missing')).toBeNull();
  });
});

describe('formatPostDate', () => {
  it('formats an ISO date and passes through anything unparseable', () => {
    expect(formatPostDate('2026-01-05')).toBe('Jan 5, 2026');
    expect(formatPostDate('someday')).toBe('someday');
    expect(formatPostDate(null)).toBeNull();
  });

  // A date-only value parses as UTC midnight, so formatting it in a zone west
  // of UTC used to render the previous calendar day.
  it('keeps the authored calendar day regardless of the viewer time zone', () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/Sao_Paulo';
    try {
      expect(formatPostDate('2026-01-05')).toBe('Jan 5, 2026');
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('buildPostListPath', () => {
  it('always sends the limit and omits the optional parameters', () => {
    expect(
      buildPostListPath({
        siteSlug: 'demo',
        contentType: null,
        search: '   ',
        pageSize: 4,
        cursor: null,
      }),
    ).toBe('/public/sites/demo/content-entries?limit=4');
  });

  it('includes the content type, the trimmed search and the cursor', () => {
    expect(
      buildPostListPath({
        siteSlug: 'demo',
        contentType: 'erc:article',
        search: '  blocks ',
        pageSize: 6,
        cursor: 'abc123',
      }),
    ).toBe(
      '/public/sites/demo/content-entries?limit=6&contentType=erc%3Aarticle&q=blocks&cursor=abc123',
    );
  });

  it('escapes a slug that needs it', () => {
    expect(
      buildPostListPath({
        siteSlug: 'a b',
        contentType: null,
        search: '',
        pageSize: 1,
        cursor: null,
      }),
    ).toContain('/public/sites/a%20b/content-entries');
  });
});

describe('cursor pager', () => {
  it('walks forward remembering where each page started', () => {
    const page2 = nextPage(INITIAL_PAGER, 'c1');
    const page3 = nextPage(page2, 'c2');
    expect(page2).toEqual({ cursor: 'c1', stack: [null] });
    expect(page3).toEqual({ cursor: 'c2', stack: [null, 'c1'] });
    expect(hasPreviousPage(page3)).toBe(true);
  });

  it('ignores a next request when there is no further page', () => {
    const page2 = nextPage(INITIAL_PAGER, 'c1');
    expect(nextPage(page2, null)).toBe(page2);
  });

  it('walks back to the exact cursors it came from', () => {
    const page3 = nextPage(nextPage(INITIAL_PAGER, 'c1'), 'c2');
    const back2 = previousPage(page3);
    expect(back2).toEqual({ cursor: 'c1', stack: [null] });
    const back1 = previousPage(back2);
    expect(back1).toEqual(INITIAL_PAGER);
    expect(hasPreviousPage(back1)).toBe(false);
  });

  it('stays on the first page when asked to go back from it', () => {
    expect(previousPage(INITIAL_PAGER)).toEqual(INITIAL_PAGER);
  });
});
