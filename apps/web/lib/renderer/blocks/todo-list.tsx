'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../../api';
import { getAccessToken } from '../../auth-storage';
import type { BlockRenderProps } from '../registry';
import {
  buildNewRecordData,
  defaultPicklistValue,
  fieldByKey,
  formatDueDate,
  isDone,
  recordTitle,
  resolveTodoFieldKeys,
  sortRecords,
  toggleDonePayload,
  usableFieldKey,
  type ObjectFieldDefinition,
  type ObjectRecord,
} from './todo-list-data';

const CSS = `
.nv-todo { font-family: var(--nv-font-body, system-ui); color: var(--nv-color-text, #1a1917); max-width: 40rem; margin: 0 auto; padding: var(--nv-space-md, 1rem); }
.nv-todo-title { margin: 0 0 var(--nv-space-md, 1rem); font-size: 1.5rem; letter-spacing: -0.01em; }
.nv-todo-card { background: var(--nv-color-surface, #fff); border: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.1)); border-radius: var(--nv-radius-md, 8px); overflow: hidden; }
.nv-todo-add { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: var(--nv-space-md, 1rem); border-bottom: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.08)); }
.nv-todo-add input[type="text"] { flex: 1 1 12rem; min-width: 0; box-sizing: border-box; padding: 0.55rem 0.75rem; font: inherit; font-size: 0.9375rem; color: inherit; background: transparent; border: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.14)); border-radius: var(--nv-radius-md, 8px); }
.nv-todo-add select { padding: 0.55rem 0.5rem; font: inherit; font-size: 0.875rem; color: inherit; background: transparent; border: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.14)); border-radius: var(--nv-radius-md, 8px); }
.nv-todo-add input:focus-visible, .nv-todo-add select:focus-visible { outline: 2px solid var(--nv-color-primary, #cc3d47); outline-offset: 1px; }
.nv-todo-add button { padding: 0.55rem 1.1rem; font: inherit; font-size: 0.9375rem; font-weight: 600; color: #fff; background: var(--nv-color-primary, #cc3d47); border: none; border-radius: var(--nv-radius-md, 8px); cursor: pointer; }
.nv-todo-add button:disabled { opacity: 0.45; cursor: default; }
.nv-todo-items { list-style: none; margin: 0; padding: 0; }
.nv-todo-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem var(--nv-space-md, 1rem); border-bottom: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.06)); }
.nv-todo-item:last-child { border-bottom: none; }
.nv-todo-check { width: 1.05rem; height: 1.05rem; flex-shrink: 0; accent-color: var(--nv-color-primary, #cc3d47); cursor: pointer; }
.nv-todo-text { flex: 1; min-width: 0; font-size: 0.9375rem; overflow-wrap: anywhere; }
.nv-todo-item-done .nv-todo-text { text-decoration: line-through; opacity: 0.45; }
.nv-todo-tag { flex-shrink: 0; padding: 0.15rem 0.5rem; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; border-radius: 999px; background: var(--nv-color-surface-alt, #f1efec); opacity: 0.75; }
.nv-todo-due { flex-shrink: 0; font-size: 0.75rem; opacity: 0.55; font-variant-numeric: tabular-nums; }
.nv-todo-remove { flex-shrink: 0; width: 1.6rem; height: 1.6rem; font: inherit; font-size: 1rem; line-height: 1; color: inherit; background: none; border: none; border-radius: var(--nv-radius-md, 8px); opacity: 0.4; cursor: pointer; }
.nv-todo-remove:hover { opacity: 1; color: var(--nv-color-primary, #cc3d47); background: var(--nv-color-surface-alt, #f1efec); }
.nv-todo-note { margin: 0; padding: var(--nv-space-lg, 2rem) var(--nv-space-md, 1rem); text-align: center; font-size: 0.9375rem; line-height: 1.6; opacity: 0.75; }
.nv-todo-note a { color: var(--nv-color-primary, #cc3d47); font-weight: 600; }
.nv-todo-error { margin: var(--nv-space-sm, 0.5rem) 0 0; font-size: 0.875rem; color: var(--nv-color-primary, #cc3d47); }
`;

type Phase = 'anonymous' | 'loading' | 'ready' | 'unauthorized' | 'failed';

// Reads and writes real Object records through the authenticated Objects API
// (spec 05). These are the management endpoints, so an anonymous visitor gets
// an explanation instead of a broken widget.
export function TodoList({ props }: BlockRenderProps) {
  const heading = typeof props.heading === 'string' ? props.heading.trim() : '';
  const definitionRef =
    typeof props.objectDefinition === 'string' ? props.objectDefinition.trim() : '';
  const keys = useMemo(() => resolveTodoFieldKeys(props), [props]);

  const [phase, setPhase] = useState<Phase>('loading');
  const [fields, setFields] = useState<readonly ObjectFieldDefinition[]>([]);
  const [records, setRecords] = useState<ObjectRecord[]>([]);
  const [draft, setDraft] = useState('');
  const [draftPriority, setDraftPriority] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priorityKey = usableFieldKey(keys.priority, fields);
  const dueDateKey = usableFieldKey(keys.dueDate, fields);
  const priorityField = fieldByKey(priorityKey, fields);

  const load = useCallback(async () => {
    if (definitionRef === '') {
      return;
    }
    try {
      const definition = await api.get<{ data: { fields: ObjectFieldDefinition[] } }>(
        `/object-definitions/${definitionRef}`,
      );
      const list = await api.get<{ data: ObjectRecord[] }>(
        `/object-definitions/${definitionRef}/records?limit=100`,
      );
      setFields(definition.data.fields);
      setRecords(list.data);
      setDraftPriority(
        defaultPicklistValue(
          definition.data.fields.find((field) => field.key === keys.priority) ?? null,
        ),
      );
      setPhase('ready');
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.problem.status : 0;
      setPhase(status === 401 || status === 403 ? 'unauthorized' : 'failed');
    }
  }, [definitionRef, keys.priority]);

  useEffect(() => {
    // The token lives in localStorage, so this can only be decided on the
    // client; the server pass always renders the loading state.
    if (getAccessToken() === null) {
      setPhase('anonymous');
      return;
    }
    void load();
  }, [load]);

  async function addItem() {
    const title = draft.trim();
    if (title === '' || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<{ data: ObjectRecord }>(
        `/object-definitions/${definitionRef}/records`,
        { data: buildNewRecordData(title, keys, fields, draftPriority) },
      );
      setRecords((current) => [...current, created.data]);
      setDraft('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The item could not be added.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(record: ObjectRecord) {
    const payload = toggleDonePayload(record, keys.done);
    const previous = records;
    setError(null);
    // Optimistic: the checkbox has to feel instant, and a failure restores the
    // exact previous list rather than guessing the server state.
    setRecords((current) =>
      current.map((item) => (item.id === record.id ? { ...item, data: payload.data } : item)),
    );
    try {
      await api.patch(`/object-records/${record.id}`, payload);
    } catch (caught) {
      setRecords(previous);
      setError(caught instanceof ApiError ? caught.message : 'The item could not be updated.');
    }
  }

  async function removeItem(record: ObjectRecord) {
    const previous = records;
    setError(null);
    setRecords((current) => current.filter((item) => item.id !== record.id));
    try {
      await api.del(`/object-records/${record.id}`);
    } catch (caught) {
      setRecords(previous);
      setError(caught instanceof ApiError ? caught.message : 'The item could not be removed.');
    }
  }

  const sorted = sortRecords(records, keys, priorityField);

  return (
    <section className="nv-todo">
      <style>{CSS}</style>
      {heading !== '' ? <h2 className="nv-todo-title">{heading}</h2> : null}
      <div className="nv-todo-card">
        {definitionRef === '' ? (
          <p className="nv-todo-note">
            This block becomes a working to do list once an object is chosen in its settings.
          </p>
        ) : phase === 'anonymous' || phase === 'unauthorized' ? (
          <p className="nv-todo-note">
            This list reads and writes real records through the authenticated Objects API, so it is
            interactive once you are signed in. <a href="/login">Sign in to the admin</a> and come
            back to add, complete and remove items.
          </p>
        ) : phase === 'failed' ? (
          <p className="nv-todo-note">The list could not be loaded right now.</p>
        ) : phase === 'loading' ? (
          <p className="nv-todo-note">Loading your items...</p>
        ) : (
          <>
            <div className="nv-todo-add">
              <input
                type="text"
                value={draft}
                placeholder="Add an item and press Enter"
                aria-label="New item"
                onChange={(event) => setDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void addItem();
                  }
                }}
              />
              {priorityField?.options && priorityField.options.length > 0 ? (
                <select
                  value={draftPriority ?? ''}
                  aria-label={priorityField.label}
                  onChange={(event) => setDraftPriority(event.currentTarget.value)}
                >
                  {priorityField.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                disabled={busy || draft.trim() === ''}
                onClick={() => void addItem()}
              >
                Add
              </button>
            </div>
            {sorted.length === 0 ? (
              <p className="nv-todo-note">Nothing here yet. Add your first item above.</p>
            ) : (
              <ul className="nv-todo-items">
                {sorted.map((record) => {
                  const done = isDone(record, keys.done);
                  const priority = priorityKey !== null ? record.data[priorityKey] : undefined;
                  const due = dueDateKey !== null ? formatDueDate(record.data[dueDateKey]) : null;
                  return (
                    <li
                      key={record.id}
                      className={done ? 'nv-todo-item nv-todo-item-done' : 'nv-todo-item'}
                    >
                      <input
                        type="checkbox"
                        className="nv-todo-check"
                        checked={done}
                        aria-label={`Mark "${recordTitle(record, keys.title)}" as done`}
                        onChange={() => void toggleItem(record)}
                      />
                      <span className="nv-todo-text">{recordTitle(record, keys.title)}</span>
                      {typeof priority === 'string' && priority !== '' ? (
                        <span className="nv-todo-tag">{priority}</span>
                      ) : null}
                      {due !== null ? <span className="nv-todo-due">{due}</span> : null}
                      <button
                        type="button"
                        className="nv-todo-remove"
                        aria-label={`Remove "${recordTitle(record, keys.title)}"`}
                        onClick={() => void removeItem(record)}
                      >
                        &times;
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
      {error !== null ? <p className="nv-todo-error">{error}</p> : null}
    </section>
  );
}
