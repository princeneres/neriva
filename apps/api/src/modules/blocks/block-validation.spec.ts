import { describe, expect, it } from 'vitest';
import { validatePropsSchema, validateSlots } from './block-validation';

describe('validatePropsSchema', () => {
  it('accepts a valid draft 2020-12 schema', () => {
    expect(
      validatePropsSchema({
        type: 'object',
        properties: { title: { type: 'string' }, level: { type: 'integer', minimum: 1 } },
        required: ['title'],
      }),
    ).toBeNull();
  });

  it('accepts an empty object schema', () => {
    expect(validatePropsSchema({})).toBeNull();
  });

  it('rejects non-object input', () => {
    expect(validatePropsSchema(null)).toMatch(/must be a JSON Schema object/);
    expect(validatePropsSchema('not a schema')).toMatch(/must be a JSON Schema object/);
    expect(validatePropsSchema([{ type: 'object' }])).toMatch(/must be a JSON Schema object/);
    expect(validatePropsSchema(true)).toMatch(/must be a JSON Schema object/);
  });

  it('rejects a schema that fails Ajv compilation and reports the reason', () => {
    const error = validatePropsSchema({ type: 'not-a-type' });
    expect(error).toContain('propsSchema is not a valid JSON Schema (draft 2020-12)');
  });

  it('rejects a schema with an invalid regex pattern', () => {
    expect(
      validatePropsSchema({ type: 'object', properties: { x: { type: 'string', pattern: '(' } } }),
    ).not.toBeNull();
  });

  it('does not fail on repeated $id values across calls', () => {
    const schema = { $id: 'https://neriva.dev/schemas/repeated', type: 'object' };
    expect(validatePropsSchema(schema)).toBeNull();
    expect(validatePropsSchema(schema)).toBeNull();
  });
});

describe('validateSlots', () => {
  it('accepts an empty slot list', () => {
    expect(validateSlots([])).toBeNull();
  });

  it('accepts unique kebab-case names with optional allowedBlocks', () => {
    expect(
      validateSlots([
        { name: 'main' },
        { name: 'side-bar', allowedBlocks: ['hero-banner'] },
        { name: 'footer2' },
      ]),
    ).toBeNull();
  });

  it('rejects duplicate slot names', () => {
    expect(validateSlots([{ name: 'main' }, { name: 'main' }])).toBe('Duplicate slot name "main"');
  });

  it('rejects names outside ^[a-z][a-z0-9-]*$', () => {
    expect(validateSlots([{ name: 'Main' }])).toMatch(/invalid/);
    expect(validateSlots([{ name: '1st' }])).toMatch(/invalid/);
    expect(validateSlots([{ name: '-lead' }])).toMatch(/invalid/);
    expect(validateSlots([{ name: 'with space' }])).toMatch(/invalid/);
    expect(validateSlots([{ name: '' }])).toMatch(/invalid/);
  });
});
