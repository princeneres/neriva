import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

// Usage: @RequirePermission('page:create'). Format: '<resourceType>:<action>'.
export const RequirePermission = (permission: `${string}:${string}`) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
