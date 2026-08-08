'use client';

import type { components } from '@neriva/contracts';

export type SystemSetting = components['schemas']['SystemSettingDto'];

export const KEY_PATTERN = /^[a-z][a-z0-9.-]*$/;

export const KEY_HINT = 'Lowercase letters, digits, dots and dashes; must start with a letter.';

// UX decision: the value textarea accepts any JSON text. If the input is not
// valid JSON (for example a bare hostname like smtp.example.com), it is sent
// as a JSON string instead of rejecting the form. Users can still force a
// string by quoting it ("8025" stays the number 8025, "\"8025\"" is a string).
export function parseValueInput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function previewValue(value: unknown, max = 80): string {
  const text = JSON.stringify(value) ?? '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Maps RFC 7807 `errors` messages to the form field they name (messages
// produced by the API start with the property name, e.g. "key must match ...").
export function splitFieldErrors(errors: string[] | undefined): {
  key: string | null;
  value: string | null;
  other: string[];
} {
  const result: { key: string | null; value: string | null; other: string[] } = {
    key: null,
    value: null,
    other: [],
  };
  for (const message of errors ?? []) {
    const firstWord = message.trim().split(/\s+/)[0]?.toLowerCase();
    if (firstWord === 'key') {
      result.key ??= message;
    } else if (firstWord === 'value') {
      result.value ??= message;
    } else {
      result.other.push(message);
    }
  }
  return result;
}

const WELL_KNOWN_KEYS = [
  { key: 'smtp.host', description: 'SMTP server hostname' },
  { key: 'smtp.port', description: 'SMTP server port' },
  { key: 'smtp.user', description: 'SMTP username' },
  { key: 'smtp.password', description: 'SMTP password' },
  { key: 'site.name', description: 'Public site name' },
  { key: 'site.description', description: 'Public site description' },
];

export function WellKnownKeysCard() {
  return (
    <div className="nv-card" style={{ marginTop: 'var(--nv-space-5)' }}>
      <div className="nv-card-body">
        <strong>Well-known keys</strong>
        <p>These keys are documented conventions, not enforced by the API.</p>
        <ul>
          {WELL_KNOWN_KEYS.map((item) => (
            <li key={item.key}>
              <code className="nv-code">{item.key}</code> {item.description}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
