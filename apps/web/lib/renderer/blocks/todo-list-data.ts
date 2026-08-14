import { formatCalendarDate } from './format-date';

// Pure helpers for the nv-todo-list block, kept apart from the component so
// the web suite can unit test them (only apps/web/lib/**/*.spec.ts runs).

export interface ObjectFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'picklist';
  required: boolean;
  options?: string[];
}

export interface ObjectRecord {
  id: string;
  externalReferenceCode: string;
  data: Record<string, unknown>;
}

export interface TodoFieldKeys {
  title: string;
  done: string;
  priority: string | null;
  dueDate: string | null;
}

export const TODO_DEFAULT_FIELDS = {
  title: 'title',
  done: 'done',
  priority: 'priority',
  dueDate: 'dueDate',
} as const;

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// title and done are structural, so a blank prop falls back to the default.
// priority and dueDate are optional controls: clearing the prop hides them,
// which is what their descriptions promise the author.
export function resolveTodoFieldKeys(props: Record<string, unknown>): TodoFieldKeys {
  return {
    title: optionalText(props.titleField) ?? TODO_DEFAULT_FIELDS.title,
    done: optionalText(props.doneField) ?? TODO_DEFAULT_FIELDS.done,
    priority:
      props.priorityField === undefined
        ? TODO_DEFAULT_FIELDS.priority
        : optionalText(props.priorityField),
    dueDate:
      props.dueDateField === undefined
        ? TODO_DEFAULT_FIELDS.dueDate
        : optionalText(props.dueDateField),
  };
}

// A configured field only earns its control when the definition really has it,
// so a mistyped key degrades to a hidden control instead of a 400 on write.
export function usableFieldKey(
  key: string | null,
  fields: readonly ObjectFieldDefinition[],
): string | null {
  if (key === null) {
    return null;
  }
  return fields.some((field) => field.key === key) ? key : null;
}

export function fieldByKey(
  key: string | null,
  fields: readonly ObjectFieldDefinition[],
): ObjectFieldDefinition | null {
  if (key === null) {
    return null;
  }
  return fields.find((field) => field.key === key) ?? null;
}

export function isDone(record: ObjectRecord, doneKey: string): boolean {
  return record.data[doneKey] === true;
}

export function recordTitle(record: ObjectRecord, titleKey: string): string {
  return optionalText(record.data[titleKey]) ?? '(untitled)';
}

// PATCH replaces the whole data payload (see UpdateObjectRecordDto), so an
// edit has to be merged onto the record's current values, never sent alone.
export function mergedRecordData(
  record: ObjectRecord,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  return { ...record.data, ...changes };
}

export function toggleDonePayload(
  record: ObjectRecord,
  doneKey: string,
): { data: Record<string, unknown> } {
  return { data: mergedRecordData(record, { [doneKey]: !isDone(record, doneKey) }) };
}

// A required picklist has to carry a value on create, so the middle option is
// the least surprising default: it reads as "normal" on a 3 step scale.
export function defaultPicklistValue(field: ObjectFieldDefinition | null): string | null {
  const options = field?.options;
  if (!options || options.length === 0) {
    return null;
  }
  return options[Math.floor((options.length - 1) / 2)] ?? null;
}

export function buildNewRecordData(
  title: string,
  keys: TodoFieldKeys,
  fields: readonly ObjectFieldDefinition[],
  priority: string | null,
): Record<string, unknown> {
  const data: Record<string, unknown> = { [keys.title]: title.trim() };
  const doneField = fieldByKey(keys.done, fields);
  if (doneField) {
    data[keys.done] = false;
  }
  const priorityKey = usableFieldKey(keys.priority, fields);
  if (priorityKey !== null) {
    const value = priority ?? defaultPicklistValue(fieldByKey(priorityKey, fields));
    if (value !== null) {
      data[priorityKey] = value;
    }
  }
  return data;
}

// Open items first, then by the picklist's own order so "High" outranks "Low"
// without hardcoding either name, then newest first (ids are UUIDv7).
export function sortRecords(
  records: readonly ObjectRecord[],
  keys: TodoFieldKeys,
  priorityField: ObjectFieldDefinition | null,
): ObjectRecord[] {
  const order = priorityField?.options ?? [];
  const rank = (record: ObjectRecord): number => {
    const value = record.data[priorityField?.key ?? ''];
    const index = typeof value === 'string' ? order.indexOf(value) : -1;
    return index === -1 ? order.length : order.length - 1 - index;
  };
  return [...records].sort((a, b) => {
    const doneDelta = Number(isDone(a, keys.done)) - Number(isDone(b, keys.done));
    if (doneDelta !== 0) {
      return doneDelta;
    }
    const rankDelta = rank(a) - rank(b);
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return b.id.localeCompare(a.id);
  });
}

export function formatDueDate(value: unknown, locale = 'en-US'): string | null {
  return formatCalendarDate(optionalText(value), { month: 'short', day: 'numeric' }, locale);
}
