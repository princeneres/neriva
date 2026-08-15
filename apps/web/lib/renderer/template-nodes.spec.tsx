import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderTemplate } from './template';
import { attrsToProps, renderTemplateNodes } from './template-nodes';

// Renders a template the way the runtime does, so these assertions are about
// the markup a visitor actually gets.
function render(
  html: string,
  slots: Record<string, string> = {},
  props: Record<string, unknown> = {},
  declared: string[] = Object.keys(slots),
): string {
  const { nodes } = renderTemplate({ html, erc: 'test', props, slots: declared });
  const slotNodes = Object.fromEntries(
    Object.entries(slots).map(([name, text]) => [name, <span key={name}>{text}</span>]),
  );
  return renderToStaticMarkup(<>{renderTemplateNodes(nodes, slotNodes)}</>);
}

describe('renderTemplateNodes', () => {
  // The regression this model exists for: with the old flat segments the
  // section was auto-closed and the children landed after it.
  it('renders slot children INSIDE the element that wraps them', () => {
    const markup = render(
      '<section class="nv-container"><div class="nv-container-inner" data-nv-slot="content"></div></section>',
      { content: 'child' },
    );
    // data-nv-slot stays on the element: the studio canvas locates slot
    // containers by it.
    expect(markup).toContain(
      '<section class="nv-container">' +
        '<div class="nv-container-inner" data-nv-slot="content"><span>child</span></div>' +
        '</section>',
    );
  });

  it('keeps both columns inside the grid when the same tag nests', () => {
    const markup = render(
      '<div class="nv-columns-2">' +
        '<div class="nv-columns-2-col" data-nv-slot="left"></div>' +
        '<div class="nv-columns-2-col" data-nv-slot="right"></div>' +
        '</div>',
      { left: 'L', right: 'R' },
    );
    expect(markup).toBe(
      '<div class="nv-columns-2">' +
        '<div class="nv-columns-2-col" data-nv-slot="left"><span>L</span></div>' +
        '<div class="nv-columns-2-col" data-nv-slot="right"><span>R</span></div>' +
        '</div>',
    );
  });

  it('keeps markup before and after a nested slot in document order', () => {
    const markup = render('<div><p>before</p><span data-nv-slot="s"></span><p>after</p></div>', {
      s: 'mid',
    });
    expect(markup).toContain('<p>before</p>');
    expect(markup.indexOf('before')).toBeLessThan(markup.indexOf('mid'));
    expect(markup.indexOf('mid')).toBeLessThan(markup.indexOf('after'));
  });

  it('renders a style attribute carrying a var() fallback', () => {
    const markup = render(
      '<section class="c" style="background: {{bg}}"><div data-nv-slot="content"></div></section>',
      { content: 'x' },
      { bg: 'var(--nv-color-surface-alt, #f1efec)' },
    );
    expect(markup).toContain('style="background:var(--nv-color-surface-alt, #f1efec)"');
  });

  it('renders a slotless template as a single html run', () => {
    expect(render('<p class="a">hi</p>')).toContain('<p class="a">hi</p>');
  });

  it('renders the slot element even when nothing fills it', () => {
    expect(
      render('<div class="w"><div data-nv-slot="content"></div></div>', {}, {}, ['content']),
    ).toBe('<div class="w"><div data-nv-slot="content"></div></div>');
  });

  it('escapes prop values rather than letting them inject markup', () => {
    const markup = render(
      '<section><h1 data-nv-text="title"></h1><div data-nv-slot="content"></div></section>',
      { content: 'x' },
      { title: '<img src=x onerror=alert(1)>' },
    );
    // The value lands as escaped text, so it can never become a real element.
    expect(markup).not.toContain('<img');
    expect(markup).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('attrsToProps', () => {
  it('maps class and for to their React names', () => {
    expect(attrsToProps(' class="a" for="b"')).toEqual({ className: 'a', htmlFor: 'b' });
  });

  it('turns a style string into an object', () => {
    expect(attrsToProps(' style="color: red"')).toEqual({ style: { color: 'red' } });
  });

  it('passes data and aria attributes through untouched', () => {
    expect(attrsToProps(' data-nv-slot="x" aria-label="y"')).toEqual({
      'data-nv-slot': 'x',
      'aria-label': 'y',
    });
  });
});
