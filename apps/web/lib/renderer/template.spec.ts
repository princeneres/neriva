import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  interpolate,
  normalizeEmbedUrl,
  renderNavList,
  renderTemplate,
  resolveStyles,
  safeUrl,
  sanitizeRich,
  scopeCss,
  buildTemplateTree,
  parseAttrs,
  styleStringToObject,
  type TemplateNode,
} from './template';

// Convenience: render a template with no slots and return its single html run.
function renderHtml(html: string, props: Record<string, unknown> = {}): string {
  const { nodes } = renderTemplate({ html, erc: 'test-block', props });
  expect(nodes).toHaveLength(1);
  const first = nodes[0] as { kind: 'html'; html: string };
  return first.html;
}

describe('escapeHtml', () => {
  it('escapes ampersand, angle brackets and quotes', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('stringifies numbers and booleans', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(false)).toBe('false');
  });

  it('returns empty string for null, undefined, objects and arrays', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml({ a: 1 })).toBe('');
    expect(escapeHtml(['<b>'])).toBe('');
  });
});

describe('interpolate', () => {
  it('replaces {{key}} with the escaped value', () => {
    expect(interpolate('<h1>{{title}}</h1>', { title: 'Hi <b>' })).toBe('<h1>Hi &lt;b&gt;</h1>');
  });

  it('replaces a missing prop with an empty string', () => {
    expect(interpolate('<p>{{missing}}</p>', {})).toBe('<p></p>');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(interpolate('{{ title }}', { title: 'x' })).toBe('x');
  });

  it('escapes quotes so values cannot break out of attributes', () => {
    expect(interpolate('<div class="v-{{variant}}">', { variant: '" onmouseover="x' })).toBe(
      '<div class="v-&quot; onmouseover=&quot;x">',
    );
  });

  it('does not re-interpolate braces contained in values', () => {
    expect(interpolate('<p>{{a}}</p>', { a: '{{b}}', b: 'nope' })).toBe('<p>{{b}}</p>');
  });

  it('stringifies numeric values', () => {
    expect(interpolate('<span>{{count}}</span>', { count: 3 })).toBe('<span>3</span>');
  });
});

describe('safeUrl', () => {
  it('allows http, https, mailto, tel and relative URLs', () => {
    expect(safeUrl('https://example.com/a?b=c')).toBe('https://example.com/a?b=c');
    expect(safeUrl('http://example.com')).toBe('http://example.com');
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeUrl('tel:+5511999999999')).toBe('tel:+5511999999999');
    expect(safeUrl('/about')).toBe('/about');
    expect(safeUrl('#section')).toBe('#section');
    expect(safeUrl('../up')).toBe('../up');
  });

  it('rejects javascript:, data: and vbscript: URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('JAVASCRIPT:alert(1)')).toBe('');
    expect(safeUrl('data:text/html,<script>x</script>')).toBe('');
    expect(safeUrl('vbscript:msgbox(1)')).toBe('');
  });

  it('rejects schemes hidden by whitespace or control characters', () => {
    expect(safeUrl('java\nscript:alert(1)')).toBe('');
    expect(safeUrl('java\tscript:alert(1)')).toBe('');
    expect(safeUrl('javascript:alert(1)')).toBe('');
  });

  it('returns empty string for empty and non-string input', () => {
    expect(safeUrl('')).toBe('');
    expect(safeUrl(undefined)).toBe('');
    expect(safeUrl({})).toBe('');
  });
});

describe('data-nv-text binding', () => {
  it('replaces the leaf inner content with the escaped value', () => {
    expect(renderHtml('<h2 class="t" data-nv-text="title">Default</h2>', { title: 'A <b>' })).toBe(
      '<h2 class="t" data-nv-text="title">A &lt;b&gt;</h2>',
    );
  });

  it('keeps the template default when the prop key is absent', () => {
    expect(renderHtml('<h2 data-nv-text="title">Default</h2>', {})).toBe(
      '<h2 data-nv-text="title">Default</h2>',
    );
  });

  it('clears the content when the prop is present but empty', () => {
    expect(renderHtml('<h2 data-nv-text="title">Default</h2>', { title: '' })).toBe(
      '<h2 data-nv-text="title"></h2>',
    );
  });

  it('keeps the binding attribute for studio inline editing', () => {
    expect(renderHtml('<span data-nv-text="x">y</span>', { x: 'z' })).toContain('data-nv-text="x"');
  });
});

describe('data-nv-rich binding and sanitizeRich', () => {
  it('keeps the allowed subset', () => {
    const value = '<p>Hi <strong>there</strong> <em>you</em></p><ul><li>a</li><li>b</li></ul>';
    expect(sanitizeRich(value)).toBe(value);
  });

  it('strips attributes from allowed tags', () => {
    expect(sanitizeRich('<p class="x" onclick="evil()">hi</p>')).toBe('<p>hi</p>');
    expect(sanitizeRich('<b style="color:red">hi</b>')).toBe('<b>hi</b>');
  });

  it('keeps a[href] only for safe protocols', () => {
    expect(sanitizeRich('<a href="https://x.com" target="_blank">go</a>')).toBe(
      '<a href="https://x.com">go</a>',
    );
    expect(sanitizeRich('<a href="javascript:alert(1)">go</a>')).toBe('<a>go</a>');
  });

  it('neutralizes entity-encoded javascript hrefs', () => {
    expect(sanitizeRich('<a href="javascript&colon;alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeRich('<a href="&#106;avascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('re-escapes entities kept in safe hrefs', () => {
    expect(sanitizeRich('<a href="/a?b=1&amp;c=2">x</a>')).toBe('<a href="/a?b=1&amp;c=2">x</a>');
  });

  it('strips disallowed tags but keeps their text', () => {
    expect(sanitizeRich('<div><span>hello</span></div>')).toBe('hello');
    expect(sanitizeRich('<h1>big</h1>')).toBe('big');
  });

  it('drops script-like content wholesale, even nested in allowed tags', () => {
    expect(sanitizeRich('<p>a<script>alert(1)</script>b</p>')).toBe('<p>ab</p>');
    expect(sanitizeRich('<style>p{color:red}</style>text')).toBe('text');
    expect(sanitizeRich('<iframe src="https://x.com">fallback</iframe>after')).toBe('after');
  });

  it('drops unterminated script content to the end', () => {
    expect(sanitizeRich('before<script>alert(1)')).toBe('before');
  });

  it('escapes stray angle brackets in text', () => {
    expect(sanitizeRich('1 < 2 > 0')).toBe('1 &lt; 2 &gt; 0');
  });

  it('removes comments, including ones hiding markup', () => {
    expect(sanitizeRich('a<!-- <script>alert(1)</script> -->b')).toBe('ab');
  });

  it('balances unclosed allowed tags', () => {
    expect(sanitizeRich('<b>bold')).toBe('<b>bold</b>');
    expect(sanitizeRich('<ul><li>one')).toBe('<ul><li>one</li></ul>');
  });

  it('drops stray closing tags', () => {
    expect(sanitizeRich('a</b>c')).toBe('ac');
  });

  it('normalizes br variants', () => {
    expect(sanitizeRich('a<br/>b<BR>c')).toBe('a<br>b<br>c');
  });

  it('applies through the data-nv-rich binding', () => {
    expect(
      renderHtml('<div class="body" data-nv-rich="body">Default</div>', {
        body: '<p onclick="x">Hello <script>alert(1)</script><b>world</b></p>',
      }),
    ).toBe('<div class="body" data-nv-rich="body"><p>Hello <b>world</b></p></div>');
  });

  it('returns empty string for non-string values', () => {
    expect(sanitizeRich(undefined)).toBe('');
    expect(sanitizeRich({})).toBe('');
  });
});

describe('data-nv-image and data-nv-alt bindings', () => {
  it('injects src and alt on a void element', () => {
    expect(
      renderHtml('<img data-nv-image="url" data-nv-alt="alt">', {
        url: 'https://cdn.x.com/a.png',
        alt: 'A "quote"',
      }),
    ).toBe(
      '<img data-nv-image="url" data-nv-alt="alt" src="https://cdn.x.com/a.png" alt="A &quot;quote&quot;">',
    );
  });

  it('replaces an existing src attribute', () => {
    expect(
      renderHtml('<img src="/placeholder.png" data-nv-image="url">', { url: '/real.png' }),
    ).toBe('<img src="/real.png" data-nv-image="url">');
  });

  it('keeps the template src when the prop key is absent', () => {
    expect(renderHtml('<img src="/placeholder.png" data-nv-image="url">', {})).toBe(
      '<img src="/placeholder.png" data-nv-image="url">',
    );
  });

  it('empties the src for unsafe protocols', () => {
    expect(renderHtml('<img data-nv-image="url">', { url: 'javascript:alert(1)' })).toBe(
      '<img data-nv-image="url" src="">',
    );
  });

  it('handles self-closing syntax', () => {
    expect(renderHtml('<img data-nv-image="url"/>', { url: '/a.png' })).toBe(
      '<img data-nv-image="url" src="/a.png"/>',
    );
  });
});

describe('data-nv-link binding', () => {
  it('injects a safe href and can combine with data-nv-text', () => {
    expect(
      renderHtml('<a class="btn" data-nv-link="url" data-nv-text="label">Go</a>', {
        url: 'https://x.com/a?b=1&c=2',
        label: 'Read more',
      }),
    ).toBe(
      '<a class="btn" data-nv-link="url" data-nv-text="label" href="https://x.com/a?b=1&amp;c=2">Read more</a>',
    );
  });

  it('empties the href for javascript: URLs', () => {
    expect(renderHtml('<a data-nv-link="url">x</a>', { url: 'javascript:alert(1)' })).toBe(
      '<a data-nv-link="url" href="">x</a>',
    );
  });

  it('replaces an existing href', () => {
    expect(renderHtml('<a href="#" data-nv-link="url">x</a>', { url: '/docs' })).toBe(
      '<a href="/docs" data-nv-link="url">x</a>',
    );
  });
});

describe('renderNavList', () => {
  it('renders one anchor per page, escaped', () => {
    expect(
      renderNavList([
        { title: 'Home', path: '/' },
        { title: 'About & Contact', path: '/about' },
      ]),
    ).toBe('<a href="/">Home</a><a href="/about">About &amp; Contact</a>');
  });

  it('renders nothing for an empty list', () => {
    expect(renderNavList([])).toBe('');
  });

  it('renders nothing (not the placeholder) when given undefined', () => {
    expect(renderNavList(undefined)).toBe('');
  });
});

describe('data-nv-nav binding', () => {
  const html = '<nav data-nv-nav="pages"><a href="/">placeholder</a></nav>';

  it('keeps the authored placeholder when sitePages is not provided', () => {
    const { nodes } = renderTemplate({ html, erc: 'nv-header', props: {} });
    expect((nodes[0] as { html: string }).html).toBe(html);
  });

  it('replaces the inner content with real links when sitePages is provided', () => {
    const { nodes } = renderTemplate({
      html,
      erc: 'nv-header',
      props: {},
      sitePages: [
        { title: 'Home', path: '/' },
        { title: 'Blog', path: '/blog' },
      ],
    });
    expect((nodes[0] as { html: string }).html).toBe(
      '<nav data-nv-nav="pages"><a href="/">Home</a><a href="/blog">Blog</a></nav>',
    );
  });

  it('renders an empty nav when the site has no published pages yet', () => {
    const { nodes } = renderTemplate({ html, erc: 'nv-header', props: {}, sitePages: [] });
    expect((nodes[0] as { html: string }).html).toBe('<nav data-nv-nav="pages"></nav>');
  });
});

describe('normalizeEmbedUrl', () => {
  it('normalizes YouTube watch, embed, shorts and short-link URLs', () => {
    const expected = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
    expect(normalizeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(expected);
    expect(normalizeEmbedUrl('https://youtube.com/embed/dQw4w9WgXcQ')).toBe(expected);
    expect(normalizeEmbedUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(expected);
    expect(normalizeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(expected);
    expect(normalizeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(expected);
    expect(normalizeEmbedUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(expected);
  });

  it('normalizes Vimeo watch and player URLs', () => {
    expect(normalizeEmbedUrl('https://vimeo.com/76979871')).toBe(
      'https://player.vimeo.com/video/76979871',
    );
    expect(normalizeEmbedUrl('https://player.vimeo.com/video/76979871')).toBe(
      'https://player.vimeo.com/video/76979871',
    );
  });

  it('rejects other hosts, lookalikes and non-http protocols', () => {
    expect(normalizeEmbedUrl('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(normalizeEmbedUrl('https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(normalizeEmbedUrl('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(normalizeEmbedUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeEmbedUrl('ftp://youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('rejects malformed ids and paths', () => {
    expect(normalizeEmbedUrl('https://youtube.com/watch?v=<script>')).toBeNull();
    expect(normalizeEmbedUrl('https://youtube.com/watch')).toBeNull();
    expect(normalizeEmbedUrl('https://vimeo.com/not-a-number')).toBeNull();
    expect(normalizeEmbedUrl('not a url')).toBeNull();
    expect(normalizeEmbedUrl('')).toBeNull();
  });
});

describe('data-nv-embed binding', () => {
  it('replaces the element with a sandboxed iframe for allowlisted hosts', () => {
    const html = renderHtml('<div class="video" data-nv-embed="url"></div>', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    expect(html).toContain('<iframe class="video"');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('sandbox="allow-scripts"');
    expect(html).not.toContain('allow-same-origin');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(html).not.toContain('data-nv-embed');
  });

  it('renders a muted placeholder for non-allowlisted hosts', () => {
    const html = renderHtml('<div data-nv-embed="url"></div>', {
      url: 'https://evil.com/watch?v=x',
    });
    expect(html).not.toContain('<iframe');
    expect(html).toContain('data-nv-embed-blocked');
    expect(html).toContain('Embed unavailable: evil.com');
  });

  it('renders a generic placeholder when the prop is missing or unparseable', () => {
    expect(renderHtml('<div data-nv-embed="url"></div>', {})).toContain('Embed unavailable');
    expect(renderHtml('<div data-nv-embed="url"></div>', { url: 'nope' })).toContain(
      'Embed unavailable',
    );
  });

  it('escapes hostile host names in the placeholder', () => {
    const html = renderHtml('<div data-nv-embed="url"></div>', {
      url: 'https://xn--evil<b>.com/x',
    });
    expect(html).not.toContain('<b>');
  });
});

describe('buildTemplateTree', () => {
  it('returns a single html run when there are no slots', () => {
    expect(buildTemplateTree('<p>hello</p>')).toEqual([{ kind: 'html', html: '<p>hello</p>' }]);
  });

  // The bug this model replaced: a flat segment list put the slot children
  // after the section, because the section's closing tag lived in a later
  // segment and the HTML parser auto-closed it.
  it('nests a slot inside the element that wraps it, keeping that element', () => {
    expect(
      buildTemplateTree(
        '<section class="s"><h2>t</h2><div data-nv-slot="content"></div></section>',
      ),
    ).toEqual([
      {
        kind: 'element',
        tag: 'section',
        attrs: ' class="s"',
        children: [
          { kind: 'html', html: '<h2>t</h2>' },
          { kind: 'slot', name: 'content', tag: 'div', attrs: ' data-nv-slot="content"' },
        ],
      },
    ]);
  });

  it('keeps the slot element own tag and attributes', () => {
    const nodes = buildTemplateTree('<div class="inner" data-nv-slot="content"></div>');
    expect(nodes).toEqual([
      {
        kind: 'slot',
        name: 'content',
        tag: 'div',
        attrs: ' class="inner" data-nv-slot="content"',
      },
    ]);
  });

  // nv-columns-2 nests a div inside a div, so "the next closing tag" is the
  // inner one: the tree builder has to count depth.
  it('matches the right closing tag when the same tag nests', () => {
    const nodes = buildTemplateTree(
      '<div class="cols"><div class="col" data-nv-slot="left"></div>' +
        '<div class="col" data-nv-slot="right"></div></div>',
    );
    expect(nodes).toHaveLength(1);
    const root = nodes[0] as { kind: 'element'; attrs: string; children: TemplateNode[] };
    expect(root.kind).toBe('element');
    expect(root.attrs).toBe(' class="cols"');
    expect(root.children.map((child) => child.kind)).toEqual(['slot', 'slot']);
  });

  it('keeps content before and after a nested slot in order', () => {
    const nodes = buildTemplateTree('<div><p>a</p><span data-nv-slot="s"></span><p>b</p></div>');
    const root = nodes[0] as { children: TemplateNode[] };
    expect(root.children).toEqual([
      { kind: 'html', html: '<p>a</p>' },
      { kind: 'slot', name: 's', tag: 'span', attrs: ' data-nv-slot="s"' },
      { kind: 'html', html: '<p>b</p>' },
    ]);
  });

  it('handles multiple slots at the top level', () => {
    const nodes = buildTemplateTree(
      '<div class="a" data-nv-slot="left"></div><hr><div class="b" data-nv-slot="right"></div>',
    );
    expect(nodes.map((node) => node.kind)).toEqual(['slot', 'html', 'slot']);
  });

  it('handles self-closing slot elements', () => {
    expect(buildTemplateTree('<div data-nv-slot="main"/>')).toEqual([
      { kind: 'slot', name: 'main', tag: 'div', attrs: ' data-nv-slot="main"/' },
    ]);
  });

  it('discards children of a non-empty slot element (invalid per spec)', () => {
    expect(buildTemplateTree('<div data-nv-slot="x"><p>gone</p></div>after')).toEqual([
      { kind: 'slot', name: 'x', tag: 'div', attrs: ' data-nv-slot="x"' },
      { kind: 'html', html: 'after' },
    ]);
  });

  it('drops whitespace-only runs', () => {
    const nodes = buildTemplateTree(
      '  <div data-nv-slot="a"></div>\n  <div data-nv-slot="b"></div>  ',
    );
    expect(nodes.map((node) => node.kind)).toEqual(['slot', 'slot']);
  });
});

describe('parseAttrs', () => {
  it('reads double, single and unquoted values, and valueless attributes', () => {
    expect(parseAttrs(' class="a b" id=\'x\' data-k=1 hidden')).toEqual({
      class: 'a b',
      id: 'x',
      'data-k': '1',
      hidden: '',
    });
  });
});

describe('styleStringToObject', () => {
  it('camel-cases properties and keeps custom properties as authored', () => {
    expect(styleStringToObject('background-color: red; --nv-x: 2px')).toEqual({
      backgroundColor: 'red',
      '--nv-x': '2px',
    });
  });

  // The seeded demo pages pass exactly this, and a comma split would break it.
  it('keeps the commas inside a var() fallback', () => {
    expect(styleStringToObject('background: var(--nv-color-surface-alt, #f1efec)')).toEqual({
      background: 'var(--nv-color-surface-alt, #f1efec)',
    });
  });

  it('ignores empty and malformed declarations', () => {
    expect(styleStringToObject('; color:; :red; margin: 0;')).toEqual({ margin: '0' });
  });
});

describe('scopeCss', () => {
  it('prefixes a simple selector', () => {
    expect(scopeCss('.title { color: red; }', 'my-block')).toBe(
      '[data-nv-b="my-block"] .title { color: red; }',
    );
  });

  it('prefixes every selector in a comma list', () => {
    expect(scopeCss('h1, .a > .b { margin: 0; }', 'x')).toBe(
      '[data-nv-b="x"] h1, [data-nv-b="x"] .a > .b { margin: 0; }',
    );
  });

  it('does not split on commas inside parentheses or brackets', () => {
    expect(scopeCss(':is(.a, .b) { color: red; }', 'x')).toBe(
      '[data-nv-b="x"] :is(.a, .b) { color: red; }',
    );
    expect(scopeCss('[data-x="a,b"] { color: red; }', 'x')).toBe(
      '[data-nv-b="x"] [data-x="a,b"] { color: red; }',
    );
  });

  it('does not split on commas inside strings', () => {
    expect(scopeCss('.a[title="x, y"] { color: red; }', 'x')).toBe(
      '[data-nv-b="x"] .a[title="x, y"] { color: red; }',
    );
  });

  it('prefixes selectors inside @media while keeping the condition', () => {
    expect(scopeCss('@media (max-width: 640px) { .col { width: 100%; } }', 'x')).toBe(
      '@media (max-width: 640px) { [data-nv-b="x"] .col { width: 100%; } }',
    );
  });

  it('leaves @keyframes and @font-face inner content untouched', () => {
    const keyframes = '@keyframes spin { from { rotate: 0deg; } to { rotate: 360deg; } }';
    expect(scopeCss(keyframes, 'x')).toBe(keyframes);
    const fontFace = "@font-face { font-family: 'X'; src: url(/x.woff2); }";
    expect(scopeCss(fontFace, 'x')).toBe(fontFace);
  });

  it('maps a leading :root to the wrapper itself', () => {
    expect(scopeCss(':root { --nv-color-primary: red; }', 'x')).toBe(
      '[data-nv-b="x"] { --nv-color-primary: red; }',
    );
  });

  it('preserves comments and declarations with strings and urls', () => {
    expect(scopeCss('/* note, with comma */ .a { content: "a, b"; }', 'x')).toBe(
      '/* note, with comma */ [data-nv-b="x"] .a { content: "a, b"; }',
    );
  });

  it('escapes </ so the output cannot close a style element', () => {
    expect(scopeCss('.a { content: "</style>"; }', 'x')).not.toContain('</style');
  });

  // Documented limitation: declaration bodies are copied verbatim, so nested
  // CSS selectors inside a rule are not re-scoped (they stay contained by the
  // prefixed parent selector).
  it('copies nested rule bodies verbatim (documented best-effort)', () => {
    expect(scopeCss('.a { .b { color: red; } }', 'x')).toBe(
      '[data-nv-b="x"] .a { .b { color: red; } }',
    );
  });

  it('preserves an unterminated rule best-effort', () => {
    expect(scopeCss('.a { color: red;', 'x')).toBe('[data-nv-b="x"] .a { color: red;}');
  });
});

describe('resolveStyles', () => {
  it('resolves token: values to style book css variables', () => {
    expect(resolveStyles({ marginTop: 'token:space-lg' })).toEqual({
      marginTop: 'var(--nv-space-lg)',
    });
  });

  it('maps textColor to color and passes raw css values through', () => {
    expect(resolveStyles({ textColor: '#333', textAlign: 'center', maxWidth: '640px' })).toEqual({
      color: '#333',
      textAlign: 'center',
      maxWidth: '640px',
    });
  });

  it('ignores unknown keys and non-string values', () => {
    expect(resolveStyles({ position: 'fixed', marginTop: 12, display: 'none' })).toEqual({});
  });

  it('ignores empty and oversized values', () => {
    expect(resolveStyles({ marginTop: '', background: 'x'.repeat(101) })).toEqual({});
  });

  it('adds borderStyle solid when a border width or color is set', () => {
    expect(resolveStyles({ borderWidth: '2px', borderColor: 'token:color-primary' })).toEqual({
      borderWidth: '2px',
      borderColor: 'var(--nv-color-primary)',
      borderStyle: 'solid',
    });
  });

  it('returns an empty object for null or undefined input', () => {
    expect(resolveStyles(null)).toEqual({});
    expect(resolveStyles(undefined)).toEqual({});
  });
});

describe('renderTemplate', () => {
  it('composes interpolation, bindings, slots and scoped css', () => {
    const result = renderTemplate({
      html:
        '<section class="hero hero-{{variant}}">' +
        '<h1 data-nv-text="title">Untitled</h1>' +
        '<div class="body" data-nv-slot="content"></div>' +
        '</section>',
      css: '.hero { padding: 2rem; } h1, .body { margin: 0; }',
      erc: 'my-hero',
      props: { variant: 'dark', title: 'Hello <world>' },
      slots: ['content'],
    });
    expect(result.nodes).toEqual([
      {
        kind: 'element',
        tag: 'section',
        attrs: ' class="hero hero-dark"',
        children: [
          { kind: 'html', html: '<h1 data-nv-text="title">Hello &lt;world&gt;</h1>' },
          // The slot element keeps class="body": that class is the layout.
          {
            kind: 'slot',
            name: 'content',
            tag: 'div',
            attrs: ' class="body" data-nv-slot="content"',
          },
        ],
      },
    ]);
    expect(result.css).toBe(
      '[data-nv-b="my-hero"] .hero { padding: 2rem; } ' +
        '[data-nv-b="my-hero"] h1, [data-nv-b="my-hero"] .body { margin: 0; }',
    );
  });

  it('drops slot nodes for undeclared slot names when slots are provided', () => {
    const { nodes } = renderTemplate({
      html: '<div data-nv-slot="known"></div><div data-nv-slot="unknown"></div>',
      erc: 'x',
      slots: ['known'],
    });
    expect(nodes.map((node) => node.kind)).toEqual(['slot']);
    expect((nodes[0] as { name: string }).name).toBe('known');
  });

  it('drops undeclared slots nested inside an element too', () => {
    const { nodes } = renderTemplate({
      html: '<div class="w"><div data-nv-slot="known"></div><div data-nv-slot="gone"></div></div>',
      erc: 'x',
      slots: ['known'],
    });
    const root = nodes[0] as { children: TemplateNode[] };
    expect(root.children).toHaveLength(1);
    expect((root.children[0] as { name: string }).name).toBe('known');
  });

  it('keeps all slot nodes when no declared slot list is provided', () => {
    const { nodes } = renderTemplate({
      html: '<div data-nv-slot="anything"></div>',
      erc: 'x',
    });
    expect(nodes.map((node) => node.kind)).toEqual(['slot']);
  });

  it('returns empty css when the block has none', () => {
    expect(renderTemplate({ html: '<p>x</p>', erc: 'x' }).css).toBe('');
    expect(renderTemplate({ html: '<p>x</p>', erc: 'x', css: null }).css).toBe('');
  });

  it('interpolates before bindings without re-processing bound values', () => {
    const { nodes } = renderTemplate({
      html: '<p data-nv-text="body">{{body}}</p>',
      erc: 'x',
      props: { body: 'safe {{body}} text' },
    });
    const first = nodes[0] as { kind: 'html'; html: string };
    expect(first.html).toBe('<p data-nv-text="body">safe {{body}} text</p>');
  });
});
