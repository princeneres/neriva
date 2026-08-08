import type { components } from '@neriva/contracts';

export type Role = components['schemas']['RoleDto'];
export type Permission = components['schemas']['PermissionDto'];

// The generator types `description` as an object because the spec declares a
// nullable string via a YAML type union; at runtime it is string | null.
export function roleDescription(role: Role): string {
  return typeof role.description === 'string' ? role.description : '';
}
