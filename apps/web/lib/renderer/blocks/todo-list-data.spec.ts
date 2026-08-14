import { describe, expect, it } from 'vitest';
import {
  buildNewRecordData,
  defaultPicklistValue,
  formatDueDate,
  isDone,
  mergedRecordData,
  recordTitle,
  resolveTodoFieldKeys,
  sortRecords,
  toggleDonePayload,
  usableFieldKey,
  type ObjectFieldDefinition,
  type ObjectRecord,
} from './todo-list-data';

const FIELDS: ObjectFieldDefinition[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  {
    key: 'priority',
    label: 'Priority',
    type: 'picklist',
    required: true,
    options: ['Low', 'Medium', 'High'],
  },
  { key: 'done', label: 'Done', type: 'boolean', required: true },
  { key: 'dueDate', label: 'Due date', type: 'date', required: false },
];

function record(id: string, data: Record<string, unknown>): ObjectRecord {
  return { id, externalReferenceCode: `erc-${id}`, data };
}

describe('resolveTodoFieldKeys', () => {
  it('defaults every key when no prop is set', () => {
    expect(resolveTodoFieldKeys({})).toEqual({
      title: 'title',
      done: 'done',
      priority: 'priority',
      dueDate: 'dueDate',
    });
  });

  it('treats a cleared optional prop as hiding that control', () => {
    const keys = resolveTodoFieldKeys({ priorityField: '', dueDateField: '  ' });
    expect(keys.priority).toBeNull();
    expect(keys.dueDate).toBeNull();
  });

  it('keeps the structural keys on their defaults even when blanked', () => {
    const keys = resolveTodoFieldKeys({ titleField: '', doneField: '  ' });
    expect(keys.title).toBe('title');
    expect(keys.done).toBe('done');
  });
});

describe('usableFieldKey', () => {
  it('drops a key the definition does not declare', () => {
    expect(usableFieldKey('priority', FIELDS)).toBe('priority');
    expect(usableFieldKey('nope', FIELDS)).toBeNull();
    expect(usableFieldKey(null, FIELDS)).toBeNull();
  });
});

describe('defaultPicklistValue', () => {
  it('picks the middle option so a required picklist is always satisfied', () => {
    expect(defaultPicklistValue(FIELDS[1] ?? null)).toBe('Medium');
    expect(defaultPicklistValue(FIELDS[0] ?? null)).toBeNull();
    expect(defaultPicklistValue(null)).toBeNull();
  });
});

describe('buildNewRecordData', () => {
  it('satisfies the required boolean and picklist fields', () => {
    const keys = resolveTodoFieldKeys({});
    expect(buildNewRecordData('  Write docs  ', keys, FIELDS, null)).toEqual({
      title: 'Write docs',
      done: false,
      priority: 'Medium',
    });
  });

  it('uses the chosen priority and omits hidden fields', () => {
    const keys = resolveTodoFieldKeys({ priorityField: '' });
    expect(buildNewRecordData('Ship it', keys, FIELDS, 'High')).toEqual({
      title: 'Ship it',
      done: false,
    });
  });
});

describe('mergedRecordData and toggleDonePayload', () => {
  it('sends the full payload, since PATCH replaces data wholesale', () => {
    const item = record('1', { title: 'A', priority: 'High', done: false, dueDate: '2026-01-05' });
    expect(toggleDonePayload(item, 'done')).toEqual({
      data: { title: 'A', priority: 'High', done: true, dueDate: '2026-01-05' },
    });
  });

  it('toggles back off from a done record', () => {
    const item = record('1', { title: 'A', done: true });
    expect(toggleDonePayload(item, 'done').data.done).toBe(false);
  });

  it('overlays only the changed keys', () => {
    expect(mergedRecordData(record('1', { a: 1, b: 2 }), { b: 3 })).toEqual({ a: 1, b: 3 });
  });
});

describe('isDone and recordTitle', () => {
  it('reads the flag strictly and names an untitled record', () => {
    expect(isDone(record('1', { done: true }), 'done')).toBe(true);
    expect(isDone(record('1', { done: 'yes' }), 'done')).toBe(false);
    expect(recordTitle(record('1', { title: ' Hi ' }), 'title')).toBe('Hi');
    expect(recordTitle(record('1', {}), 'title')).toBe('(untitled)');
  });
});

describe('sortRecords', () => {
  it('puts open items first, then the picklist order, then newest', () => {
    const keys = resolveTodoFieldKeys({});
    const priority = FIELDS[1] ?? null;
    const sorted = sortRecords(
      [
        record('a', { title: 'done high', priority: 'High', done: true }),
        record('b', { title: 'open low', priority: 'Low', done: false }),
        record('c', { title: 'open high', priority: 'High', done: false }),
      ],
      keys,
      priority,
    );
    expect(sorted.map((item) => item.data.title)).toEqual(['open high', 'open low', 'done high']);
  });

  it('does not mutate the input', () => {
    const input = [record('a', { done: true }), record('b', { done: false })];
    sortRecords(input, resolveTodoFieldKeys({}), null);
    expect(input.map((item) => item.id)).toEqual(['a', 'b']);
  });
});

describe('formatDueDate', () => {
  it('formats a date, passes through junk and ignores empties', () => {
    expect(formatDueDate('2026-01-05')).toBe('Jan 5');
    expect(formatDueDate('later')).toBe('later');
    expect(formatDueDate('')).toBeNull();
    expect(formatDueDate(undefined)).toBeNull();
  });
});
