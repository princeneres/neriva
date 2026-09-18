import { describe, expect, it } from 'vitest';
import {
  validateBlockCss,
  validateBlockJavaScript,
  validateBlockTemplate,
} from './template-validation';

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    url: { type: 'string' },
    alt: { type: 'string' },
    level: { type: 'string' },
  },
};

describe('validateBlockTemplate', () => {
  it('accepts a template with interpolation, bindings and a declared slot', () => {
    const html = `
      <section class="hero hero-{{level}}">
        <h1 data-nv-text="title">Fallback title</h1>
        <div data-nv-rich="body">Fallback body</div>
        <img data-nv-image="url" data-nv-alt="alt" src="" alt="" />
        <a data-nv-link="url" href="#">Read more</a>
        <div data-nv-slot="content"></div>
      </section>`;
    expect(validateBlockTemplate(html, [{ name: 'content' }], SCHEMA)).toBeNull();
  });

  it('accepts bindings on void elements and self-closing tags', () => {
    expect(validateBlockTemplate('<img data-nv-image="url">', [], SCHEMA)).toBeNull();
    expect(validateBlockTemplate('<img data-nv-image="url" />', [], SCHEMA)).toBeNull();
  });

  it('accepts a slot element containing only whitespace', () => {
    expect(
      validateBlockTemplate('<div data-nv-slot="main">\n  </div>', [{ name: 'main' }], SCHEMA),
    ).toBeNull();
  });

  it('rejects a binding on a non-leaf element', () => {
    const error = validateBlockTemplate(
      '<div data-nv-text="title"><span>nested</span></div>',
      [],
      SCHEMA,
    );
    expect(error).toContain('data-nv-text="title"');
    expect(error).toContain('leaf');
  });

  it('rejects a slot element with element content', () => {
    const error = validateBlockTemplate(
      '<div data-nv-slot="main"><p>not empty</p></div>',
      [{ name: 'main' }],
      SCHEMA,
    );
    expect(error).toContain('data-nv-slot="main"');
    expect(error).toContain('empty');
  });

  it('rejects a slot element with text content', () => {
    const error = validateBlockTemplate(
      '<div data-nv-slot="main">text</div>',
      [{ name: 'main' }],
      SCHEMA,
    );
    expect(error).toContain('empty');
  });

  it('rejects a slot name that is not declared', () => {
    const error = validateBlockTemplate(
      '<div data-nv-slot="ghost"></div>',
      [{ name: 'main' }],
      SCHEMA,
    );
    expect(error).toContain('data-nv-slot="ghost"');
    expect(error).toContain('not declared');
  });

  it('rejects a bound prop that does not exist in the schema properties', () => {
    const error = validateBlockTemplate('<h1 data-nv-text="ghost"></h1>', [], SCHEMA);
    expect(error).toContain('data-nv-text="ghost"');
    expect(error).toContain('does not exist in propsSchema.properties');
  });

  it('allows a dynamic semantic tag only when it references a declared prop', () => {
    expect(validateBlockTemplate('<h2 data-nv-tag="level">Heading</h2>', [], SCHEMA)).toBeNull();
    expect(validateBlockTemplate('<h2 data-nv-tag="missing">Heading</h2>', [], SCHEMA)).toContain(
      'does not exist',
    );
  });

  it('only accepts declared collection runtimes', () => {
    expect(
      validateBlockTemplate('<section data-nv-runtime="content-entries"></section>', [], SCHEMA),
    ).toBeNull();
    expect(
      validateBlockTemplate('<section data-nv-runtime="anything"></section>', [], SCHEMA),
    ).toContain('data-nv-runtime');
  });

  it('validates runtime configuration as a schema binding', () => {
    const schema = {
      type: 'object',
      properties: { objectRef: { type: 'string' }, taskTitle: { type: 'string' } },
    };
    expect(
      validateBlockTemplate(
        '<section data-nv-runtime="object-records" data-nv-runtime-object-definition="objectRef" data-nv-runtime-title-field="taskTitle"></section>',
        [],
        schema,
      ),
    ).toBeNull();
    expect(
      validateBlockTemplate(
        '<section data-nv-runtime="object-records" data-nv-runtime-object-definition="missing"></section>',
        [],
        schema,
      ),
    ).toContain('data-nv-runtime-object-definition="missing"');
  });

  it('checks the data-nv-alt companion and engine hooks against the schema too', () => {
    expect(
      validateBlockTemplate('<img data-nv-image="url" data-nv-alt="nope">', [], SCHEMA),
    ).toContain('data-nv-alt="nope"');
    expect(validateBlockTemplate('<div data-nv-embed="nope"></div>', [], SCHEMA)).toContain(
      'data-nv-embed="nope"',
    );
    expect(validateBlockTemplate('<div data-nv-embed="url"></div>', [], SCHEMA)).toBeNull();
  });

  it('rejects binding a prop when the schema declares no properties', () => {
    expect(
      validateBlockTemplate('<h1 data-nv-text="title"></h1>', [], { type: 'object' }),
    ).toContain('does not exist');
  });

  it('rejects an unclosed binding or slot element', () => {
    expect(validateBlockTemplate('<div data-nv-text="title">', [], SCHEMA)).toContain(
      'never closed',
    );
    expect(
      validateBlockTemplate('<div data-nv-slot="main">', [{ name: 'main' }], SCHEMA),
    ).toContain('never closed');
  });

  it('handles same-tag nesting when matching close tags', () => {
    const error = validateBlockTemplate('<div data-nv-text="title"><div></div></div>', [], SCHEMA);
    expect(error).toContain('leaf');
  });

  it('rejects script and iframe elements', () => {
    expect(validateBlockTemplate('<script>alert(1)</script>', [], SCHEMA)).toContain('<script>');
    expect(validateBlockTemplate('<IFRAME src="x"></IFRAME>', [], SCHEMA)).toContain('<iframe>');
  });

  it('rejects event handler attributes', () => {
    expect(validateBlockTemplate('<button onclick="steal()">x</button>', [], SCHEMA)).toContain(
      'onclick',
    );
    expect(validateBlockTemplate('<img src="x" ONERROR="steal()">', [], SCHEMA)).toContain(
      'onerror',
    );
  });

  it('rejects javascript: and data:text URLs, including whitespace tricks', () => {
    expect(validateBlockTemplate('<a href="javascript:alert(1)">x</a>', [], SCHEMA)).toContain(
      'javascript:',
    );
    expect(validateBlockTemplate('<a href="java\nscript:x">x</a>', [], SCHEMA)).toContain(
      'javascript:',
    );
    expect(validateBlockTemplate('<a href="JAVASCRIPT:alert(1)">x</a>', [], SCHEMA)).toContain(
      'javascript:',
    );
    expect(validateBlockTemplate('<a href="javascript\t:alert(1)">x</a>', [], SCHEMA)).toContain(
      'javascript:',
    );
    expect(validateBlockTemplate('<a href="data:text/html,<b>x</b>">x</a>', [], SCHEMA)).toContain(
      'data:text',
    );
    expect(validateBlockTemplate('<a href="j&#x61;vascript:alert(1)">x</a>', [], SCHEMA)).toContain(
      'javascript:',
    );
    expect(validateBlockTemplate('<a href="java&#115;cript:alert(1)">x</a>', [], SCHEMA)).toContain(
      'javascript:',
    );
    expect(
      validateBlockTemplate('<svg><a xlink:href="javascript:x"></a></svg>', [], SCHEMA),
    ).toContain('javascript:');
  });

  it('accepts plain markup without any nv attributes', () => {
    expect(validateBlockTemplate('<hr class="rule">', [], { type: 'object' })).toBeNull();
    expect(validateBlockTemplate('<div class="spacer {{level}}"></div>', [], SCHEMA)).toBeNull();
  });

  it('accepts data-nv-nav="pages" even with an authored placeholder link inside', () => {
    expect(
      validateBlockTemplate('<nav data-nv-nav="pages"><a href="/">Home</a></nav>', [], SCHEMA),
    ).toBeNull();
  });

  it('rejects data-nv-nav with any value other than "pages"', () => {
    expect(validateBlockTemplate('<nav data-nv-nav="sites"></nav>', [], SCHEMA)).toContain(
      'data-nv-nav must be "pages"',
    );
    expect(validateBlockTemplate('<nav data-nv-nav=""></nav>', [], SCHEMA)).toContain(
      'data-nv-nav must be "pages"',
    );
  });

  it('still rejects an unclosed data-nv-nav element', () => {
    expect(validateBlockTemplate('<nav data-nv-nav="pages">', [], SCHEMA)).toContain(
      'is never closed',
    );
  });
});

describe('validateBlockCss', () => {
  it('accepts token-based css', () => {
    expect(
      validateBlockCss(
        '.hero { color: var(--nv-color-primary, #cc3d47); background: url(/img.png); }',
      ),
    ).toBeNull();
  });

  it('rejects @import', () => {
    expect(validateBlockCss('@import url("http://evil");')).toContain('@import');
  });

  it('rejects expression()', () => {
    expect(validateBlockCss('.x { width: expression (alert(1)); }')).toContain('expression()');
  });

  it('rejects url(javascript:)', () => {
    expect(validateBlockCss('.x { background: url( "javascript:alert(1)" ); }')).toContain(
      'url(javascript:)',
    );
  });
});

describe('validateBlockJavaScript', () => {
  it('accepts isolated DOM code that posts a declared action', () => {
    expect(
      validateBlockJavaScript(
        "document.querySelector('button')?.addEventListener('click', () => parent.postMessage({ action: 'object-records:create' }, '*'));",
      ),
    ).toBeNull();
  });

  it('rejects tags, network access, dynamic evaluation, storage and parent access', () => {
    expect(validateBlockJavaScript('<script>alert(1)</script>')).toContain('<script>');
    expect(validateBlockJavaScript('fetch("https://example.com")')).toContain('network');
    expect(validateBlockJavaScript('eval("alert(1)")')).toContain('eval');
    expect(validateBlockJavaScript('localStorage.getItem("token")')).toContain('storage');
    expect(validateBlockJavaScript('parent.document.body')).toContain('parent window');
  });
});
