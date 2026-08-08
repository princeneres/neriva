import type { components } from '@neriva/contracts';

export type Role = components['schemas']['RoleDto'];

export function userInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// The API reports validation problems as `errors: string[]` where each entry
// starts with the field name (e.g. "email must be an email").
export function findFieldError(errors: string[] | undefined, field: string): string | undefined {
  return errors?.find((message) => message.toLowerCase().startsWith(field.toLowerCase()));
}
