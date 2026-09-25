import { describe, expect, it } from 'vitest';
import {
  CATALOG_SECRET_KEYS,
  SETTINGS_CATALOG,
  SETTING_GROUPS,
  catalogKeys,
  findSettingDefinition,
} from './settings-catalog';
import { isSensitiveSettingKey } from './system-settings.service';

// Spec 07 key rule, restated here so a bad catalog entry fails at build time
// instead of at the first PUT.
const SETTING_KEY_PATTERN = /^[a-z][a-z0-9.-]*$/;

describe('settings catalog', () => {
  it('declares keys the settings API accepts', () => {
    for (const definition of SETTINGS_CATALOG) {
      expect(definition.key).toMatch(SETTING_KEY_PATTERN);
      expect(definition.key.length).toBeLessThanOrEqual(100);
    }
  });

  it('has no duplicate keys', () => {
    const keys = catalogKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('places every setting in a declared group', () => {
    const groupIds = new Set(SETTING_GROUPS.map((group) => group.id));
    for (const definition of SETTINGS_CATALOG) {
      expect(groupIds.has(definition.group)).toBe(true);
    }
  });

  it('gives every setting a plain sentence about whether it does anything', () => {
    for (const definition of SETTINGS_CATALOG) {
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.effectNote.length).toBeGreaterThan(0);
    }
  });

  it('warns on every group whose settings are all stored only', () => {
    for (const group of SETTING_GROUPS) {
      const entries = SETTINGS_CATALOG.filter((definition) => definition.group === group.id);
      expect(entries.length).toBeGreaterThan(0);
      if (entries.every((entry) => entry.effect === 'STORED')) {
        expect(group.notice).not.toBeNull();
      }
    }
  });

  it('keeps default values consistent with the declared type', () => {
    for (const definition of SETTINGS_CATALOG) {
      if (definition.defaultValue === null) {
        continue;
      }
      if (definition.type === 'number') {
        expect(typeof definition.defaultValue).toBe('number');
      } else if (definition.type === 'boolean') {
        expect(typeof definition.defaultValue).toBe('boolean');
      } else {
        expect(typeof definition.defaultValue).toBe('string');
      }
    }
  });

  it('offers fixed options only for selects, and never both sources at once', () => {
    for (const definition of SETTINGS_CATALOG) {
      if (definition.options !== null || definition.optionsSource !== null) {
        expect(definition.type).toBe('select');
      }
      expect(definition.options !== null && definition.optionsSource !== null).toBe(false);
    }
  });

  it('redacts every password entry through the existing sensitive-key check', () => {
    const passwordKeys = SETTINGS_CATALOG.filter((d) => d.type === 'password').map((d) => d.key);
    expect(passwordKeys.length).toBeGreaterThan(0);
    for (const key of passwordKeys) {
      expect(CATALOG_SECRET_KEYS.has(key)).toBe(true);
      expect(isSensitiveSettingKey(key)).toBe(true);
    }
  });

  it('never marks a sensitive key as an ordinary field', () => {
    for (const definition of SETTINGS_CATALOG) {
      if (isSensitiveSettingKey(definition.key)) {
        expect(definition.type).toBe('password');
      }
    }
  });

  it('looks definitions up by key', () => {
    expect(findSettingDefinition('smtp.host')?.group).toBe('email');
    expect(findSettingDefinition('not.in.catalog')).toBeNull();
  });
});
