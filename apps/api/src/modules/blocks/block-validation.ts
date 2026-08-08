import { Ajv2020 } from 'ajv/dist/2020';
import type { BlockSlot } from '../../db/schema';

const SLOT_NAME_RE = /^[a-z][a-z0-9-]*$/;

// One shared instance: compiled schemas are only used to prove the input is a
// valid JSON Schema, so caching by reference is irrelevant but harmless.
const ajv = new Ajv2020({ strict: false });

// Returns null when propsSchema is a valid JSON Schema (draft 2020-12)
// object, otherwise the human-readable reason for the 400 response.
export function validatePropsSchema(propsSchema: unknown): string | null {
  if (typeof propsSchema !== 'object' || propsSchema === null || Array.isArray(propsSchema)) {
    return 'propsSchema must be a JSON Schema object';
  }
  try {
    // A fresh compile each time; removeSchema avoids collisions when two
    // schemas declare the same $id.
    ajv.removeSchema();
    ajv.compile(propsSchema);
    return null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `propsSchema is not a valid JSON Schema (draft 2020-12): ${reason}`;
  }
}

// Returns null when slots is a valid slot list, otherwise the reason.
// Rules (spec 02): unique names matching ^[a-z][a-z0-9-]*$; allowedBlocks is
// an optional array of block ERCs (existence not enforced in v1).
export function validateSlots(slots: BlockSlot[]): string | null {
  const seen = new Set<string>();
  for (const slot of slots) {
    if (!SLOT_NAME_RE.test(slot.name)) {
      return `Slot name "${slot.name}" is invalid: must match ${SLOT_NAME_RE.source}`;
    }
    if (seen.has(slot.name)) {
      return `Duplicate slot name "${slot.name}"`;
    }
    seen.add(slot.name);
  }
  return null;
}
