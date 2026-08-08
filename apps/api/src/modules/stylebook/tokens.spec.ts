import { describe, expect, it } from 'vitest';
import { findTokenViolations, renderCss } from './tokens';

describe('findTokenViolations', () => {
  it('accepts a valid token map', () => {
    expect(
      findTokenViolations({
        'color-primary': '#cc3d47',
        'space-4': '1rem',
        radius: '4px',
        h1: '2rem',
      }),
    ).toBeNull();
  });

  it('accepts an empty map', () => {
    expect(findTokenViolations({})).toBeNull();
  });

  it('rejects names that do not match ^[a-z][a-z0-9-]*$', () => {
    const violations = findTokenViolations({
      'Color-Primary': '#fff',
      '4space': '1rem',
      has_underscore: '1px',
      '-leading-dash': '0',
      valid: 'ok',
    });
    expect(violations).not.toBeNull();
    expect(violations!.invalidNames.sort()).toEqual([
      '-leading-dash',
      '4space',
      'Color-Primary',
      'has_underscore',
    ]);
    expect(violations!.invalidValues).toEqual([]);
  });

  it('rejects empty, whitespace-only and non-string values', () => {
    const violations = findTokenViolations({
      'empty-value': '',
      'blank-value': '   ',
      'number-value': 4,
      valid: '#000',
    });
    expect(violations).not.toBeNull();
    expect(violations!.invalidValues.sort()).toEqual([
      'blank-value',
      'empty-value',
      'number-value',
    ]);
    expect(violations!.invalidNames).toEqual([]);
  });

  it('reports a key under both lists when name and value are invalid', () => {
    const violations = findTokenViolations({ BAD: '' });
    expect(violations).toEqual({ invalidNames: ['BAD'], invalidValues: ['BAD'] });
  });
});

describe('renderCss', () => {
  it('renders tokens as --nv- prefixed custom properties on :root', () => {
    const css = renderCss({ 'color-primary': '#cc3d47', 'space-4': '1rem' });
    expect(css).toBe(':root {\n  --nv-color-primary: #cc3d47;\n  --nv-space-4: 1rem;\n}\n');
  });

  it('sorts token names for deterministic output', () => {
    const css = renderCss({ 'space-4': '1rem', 'color-primary': '#cc3d47' });
    expect(css).toBe(':root {\n  --nv-color-primary: #cc3d47;\n  --nv-space-4: 1rem;\n}\n');
  });

  it('renders an empty map as an empty :root block', () => {
    expect(renderCss({})).toBe(':root {\n}\n');
  });
});
