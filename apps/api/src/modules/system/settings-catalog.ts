// Catalog of known system settings (spec 07).
//
// The settings table stays free-form: any key matching the key pattern can be
// stored through the API. This catalog is the *described* subset, served over
// REST so that any client, not just the Admin UI, can render a typed form
// instead of asking a user to hand-write JSON.
//
// `effect` is deliberately part of the contract: APPLIED means something in
// Neriva reads the value today, STORED means the row is kept for a feature
// that does not exist yet. A client is expected to say which is which rather
// than implying every field does something.

export type SettingValueType = 'string' | 'text' | 'number' | 'boolean' | 'select' | 'password';

export type SettingEffect = 'APPLIED' | 'STORED';

export const SETTING_VALUE_TYPES: SettingValueType[] = [
  'string',
  'text',
  'number',
  'boolean',
  'select',
  'password',
];

export const SETTING_EFFECTS: SettingEffect[] = ['APPLIED', 'STORED'];

export interface SettingOption {
  value: string;
  label: string;
}

export interface SettingGroupDefinition {
  id: string;
  label: string;
  description: string;
  // Shown by clients above the whole group, e.g. to warn that nothing reads
  // these values yet. Null when the group needs no warning.
  notice: string | null;
}

export interface SettingDefinition {
  key: string;
  group: string;
  label: string;
  description: string;
  type: SettingValueType;
  // Value that applies when no row exists. Null means "no default, the
  // consumer has its own fallback".
  defaultValue: unknown;
  // Fixed choices for a select. Null when the choices are not fixed.
  options: SettingOption[] | null;
  // Tells a client to fill the choices from another endpoint instead.
  optionsSource: 'SITES' | null;
  effect: SettingEffect;
  // Plain sentence naming where the value takes effect, or why it does not.
  effectNote: string;
  placeholder: string | null;
}

export const SETTING_GROUPS: SettingGroupDefinition[] = [
  {
    id: 'site',
    label: 'Public site',
    description: 'How visitors reach your content when they open the site address.',
    notice: null,
  },
  {
    id: 'email',
    label: 'Email (SMTP)',
    description: 'Mail server credentials, kept in one place for when Neriva can send email.',
    notice:
      'Neriva does not send email yet. Nothing in the product connects to a mail server, so filling this in changes nothing today: the values are stored so the mail feature can read them once it exists.',
  },
];

export const SETTINGS_CATALOG: SettingDefinition[] = [
  {
    key: 'site.default',
    group: 'site',
    label: 'Default site',
    description:
      'The site served at the root address of this install. Leave it automatic and the first site you created is used.',
    type: 'select',
    defaultValue: null,
    options: null,
    optionsSource: 'SITES',
    effect: 'APPLIED',
    effectNote:
      'Read by the delivery API on every public request: it decides which site "/" serves, and which site the admin "Visit site" link opens.',
    placeholder: null,
  },
  {
    key: 'smtp.host',
    group: 'email',
    label: 'Server address',
    description: 'Address of the mail server, for example smtp.example.com.',
    type: 'string',
    defaultValue: '',
    options: null,
    optionsSource: null,
    effect: 'STORED',
    effectNote: 'Stored only. No code in Neriva connects to a mail server yet.',
    placeholder: 'smtp.example.com',
  },
  {
    key: 'smtp.port',
    group: 'email',
    label: 'Port',
    description: 'Port the mail server listens on. Most providers use 587, or 465 with TLS.',
    type: 'number',
    defaultValue: 587,
    options: null,
    optionsSource: null,
    effect: 'STORED',
    effectNote: 'Stored only. No code in Neriva connects to a mail server yet.',
    placeholder: '587',
  },
  {
    key: 'smtp.secure',
    group: 'email',
    label: 'Connect over TLS',
    description:
      'Turn on when the provider asks for an encrypted connection from the start, which usually means port 465.',
    type: 'boolean',
    defaultValue: false,
    options: null,
    optionsSource: null,
    effect: 'STORED',
    effectNote: 'Stored only. No code in Neriva connects to a mail server yet.',
    placeholder: null,
  },
  {
    key: 'smtp.user',
    group: 'email',
    label: 'Username',
    description: 'Account Neriva would sign in to the mail server with.',
    type: 'string',
    defaultValue: '',
    options: null,
    optionsSource: null,
    effect: 'STORED',
    effectNote: 'Stored only. No code in Neriva connects to a mail server yet.',
    placeholder: 'mailer@example.com',
  },
  {
    key: 'smtp.password',
    group: 'email',
    label: 'Password',
    description:
      'Password for that account. Once saved it is never sent back by the API, so it cannot be read again from here.',
    type: 'password',
    defaultValue: '',
    options: null,
    optionsSource: null,
    effect: 'STORED',
    effectNote: 'Stored only. No code in Neriva connects to a mail server yet.',
    placeholder: null,
  },
  {
    key: 'smtp.from',
    group: 'email',
    label: 'Send from address',
    description: 'Address that would appear as the sender of email Neriva sends.',
    type: 'string',
    defaultValue: '',
    options: null,
    optionsSource: null,
    effect: 'STORED',
    effectNote: 'Stored only. No code in Neriva connects to a mail server yet.',
    placeholder: 'no-reply@example.com',
  },
];

const CATALOG_BY_KEY = new Map(SETTINGS_CATALOG.map((definition) => [definition.key, definition]));

// Keys the catalog itself declares as secrets. Redaction still primarily keys
// off the key suffix; this set only widens it, so a catalog entry can never be
// a password field whose value is handed back in a response.
export const CATALOG_SECRET_KEYS: ReadonlySet<string> = new Set(
  SETTINGS_CATALOG.filter((definition) => definition.type === 'password').map((d) => d.key),
);

export function findSettingDefinition(key: string): SettingDefinition | null {
  return CATALOG_BY_KEY.get(key) ?? null;
}

export function catalogKeys(): string[] {
  return SETTINGS_CATALOG.map((definition) => definition.key);
}
