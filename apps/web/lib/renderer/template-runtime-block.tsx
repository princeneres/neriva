'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { apiUrl } from '../api-url';
import { getAccessToken } from '../auth-storage';
import { BlockScriptSandbox } from './block-script-sandbox';
import {
  buildNewRecordData,
  fieldByKey,
  formatDueDate,
  mergedRecordData,
  recordTitle,
  resolveTodoFieldKeys,
  sortRecords,
  type ObjectFieldDefinition,
} from './blocks/todo-list-data';
import {
  expandTemplateCollections,
  renderTemplate,
  templateRuntime,
  templateRuntimeBindings,
  type NavPage,
} from './template';

interface Entry {
  id: string;
  title: string;
  values: Record<string, unknown>;
}

interface ObjectRecord {
  id: string;
  externalReferenceCode: string;
  data: Record<string, unknown>;
}

interface ObjectDefinition {
  fields: ObjectFieldDefinition[];
}

interface ObjectRecordsRequest {
  kind: 'create' | 'update' | 'delete';
  id?: string;
  data?: Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function configuredRuntimeProps(
  props: Record<string, unknown>,
  bindings: ReturnType<typeof templateRuntimeBindings>,
): Record<string, unknown> {
  // The logical names below are platform conventions. A template can point
  // each one at any schema key using data-nv-runtime-*, so source rather than
  // an ERC-specific React component defines the runtime configuration.
  return {
    ...props,
    contentType: props[bindings.contentType ?? 'contentType'],
    pageSize: props[bindings.pageSize ?? 'pageSize'],
    summaryField: props[bindings.summaryField ?? 'summaryField'],
    bodyField: props[bindings.bodyField ?? 'bodyField'],
    dateField: props[bindings.dateField ?? 'dateField'],
    imageField: props[bindings.imageField ?? 'imageField'],
    objectDefinition: props[bindings.objectDefinition ?? 'objectDefinition'],
    titleField: props[bindings.titleField ?? 'titleField'],
    doneField: props[bindings.doneField ?? 'doneField'],
    priorityField: props[bindings.priorityField ?? 'priorityField'],
    dueDateField: props[bindings.dueDateField ?? 'dueDateField'],
  };
}

function objectRecordsRequest(
  payload: unknown,
  objectDefinition: string,
): ObjectRecordsRequest | null {
  if (
    !isRecord(payload) ||
    typeof payload.method !== 'string' ||
    typeof payload.path !== 'string'
  ) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(payload.path, 'https://neriva-runtime.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'https://neriva-runtime.invalid') return null;

  const recordsPath = `/object-definitions/${encodeURIComponent(objectDefinition)}/records`;
  if (payload.method === 'POST' && url.pathname === recordsPath && url.search === '') {
    const body = isRecord(payload.body) ? payload.body : null;
    return isRecord(body?.data) ? { kind: 'create', data: body.data } : null;
  }
  const recordId = /^\/object-records\/([^/]+)$/.exec(url.pathname)?.[1];
  if (!recordId || url.search !== '') return null;
  let id: string;
  try {
    id = decodeURIComponent(recordId);
  } catch {
    return null;
  }
  if (payload.method === 'PATCH') {
    const body = isRecord(payload.body) ? payload.body : null;
    return isRecord(body?.data) ? { kind: 'update', id, data: body.data } : null;
  }
  return payload.method === 'DELETE' ? { kind: 'delete', id } : null;
}

function legacyObjectRecordsRequest(
  action: string,
  payload: unknown,
  titleField: string,
  doneField: string,
): ObjectRecordsRequest | null {
  if (!isRecord(payload)) return null;
  if (action === 'object-records:create') {
    const title = text(payload.title).trim();
    return title === '' ? null : { kind: 'create', data: { [titleField]: title } };
  }
  const id = text(payload.id);
  if (id === '') return null;
  if (action === 'object-records:update' && typeof payload.done === 'boolean') {
    return { kind: 'update', id, data: { [doneField]: payload.done } };
  }
  return action === 'object-records:delete' ? { kind: 'delete', id } : null;
}

function renderedHtml(
  html: string,
  css: string | null | undefined,
  erc: string,
  props: Record<string, unknown>,
  collections: Record<string, Record<string, unknown>[]>,
  sitePages: NavPage[] | undefined,
  siteBasePath: string | undefined,
): { html: string; css: string } {
  const result = renderTemplate({
    html: expandTemplateCollections(html, collections),
    css,
    erc,
    props,
    sitePages,
    siteBasePath,
  });
  return {
    html: result.nodes
      .filter((node): node is { kind: 'html'; html: string } => node.kind === 'html')
      .map((node) => node.html)
      .join(''),
    css: result.css,
  };
}

function contentItems(entries: Entry[], props: Record<string, unknown>): Record<string, unknown>[] {
  const summaryKey = text(props.summaryField) || 'summary';
  const bodyKey = text(props.bodyField) || 'body';
  const dateKey = text(props.dateField) || 'publishedOn';
  const imageKey = text(props.imageField) || 'thumbnail';
  return entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    summary: text(entry.values[summaryKey]),
    body: text(entry.values[bodyKey]),
    date: text(entry.values[dateKey]),
    image: text(entry.values[imageKey]),
  }));
}

function objectItems(
  records: ObjectRecord[],
  props: Record<string, unknown>,
  fields: ObjectFieldDefinition[],
): Record<string, unknown>[] {
  const keys = resolveTodoFieldKeys(props);
  const priorityField = fieldByKey(keys.priority, fields);
  return sortRecords(records, keys, priorityField).map((record) => ({
    id: record.id,
    title: recordTitle(record, keys.title),
    done: record.data[keys.done] === true ? 'true' : 'false',
    priority: keys.priority === null ? '' : text(record.data[keys.priority]),
    dueDate: keys.dueDate === null ? '' : (formatDueDate(record.data[keys.dueDate]) ?? ''),
  }));
}

// A single declarative runtime for collection templates. It is selected by
// data-nv-runtime in persisted source, never by a Block ERC. The source still
// owns the markup and CSS; this component only supplies runtime data.
export function TemplateRuntimeBlock({
  html,
  css,
  js,
  erc,
  props,
  siteSlug,
  sitePages,
  siteBasePath,
}: {
  html: string;
  css?: string | null;
  js?: string | null;
  erc: string;
  props: Record<string, unknown>;
  siteSlug?: string;
  sitePages?: NavPage[];
  siteBasePath?: string;
}) {
  const runtime = templateRuntime(html);
  const runtimeBindings = useMemo(() => templateRuntimeBindings(html), [html]);
  const runtimeProps = useMemo(
    () => configuredRuntimeProps(props, runtimeBindings),
    [props, runtimeBindings],
  );
  const [entries, setEntries] = useState<Entry[]>([]);
  const [records, setRecords] = useState<ObjectRecord[]>([]);
  const [objectFields, setObjectFields] = useState<ObjectFieldDefinition[]>([]);

  const contentType = text(runtimeProps.contentType).trim();
  const objectDefinition = text(runtimeProps.objectDefinition).trim();
  const limit =
    typeof runtimeProps.pageSize === 'number'
      ? Math.min(24, Math.max(1, runtimeProps.pageSize))
      : 6;

  useEffect(() => {
    if (runtime !== 'content-entries' || !siteSlug || !contentType) {
      setEntries([]);
      return;
    }
    let active = true;
    const query = new URLSearchParams({ contentType, limit: String(limit) });
    fetch(
      apiUrl(`/public/sites/${encodeURIComponent(siteSlug)}/content-entries?${query.toString()}`),
    )
      .then(async (response) =>
        response.ok ? (response.json() as Promise<{ data: Entry[] }>) : null,
      )
      .then((body) => {
        if (active) setEntries(body?.data ?? []);
      })
      .catch(() => {
        if (active) setEntries([]);
      });
    return () => {
      active = false;
    };
  }, [contentType, limit, runtime, siteSlug]);

  useEffect(() => {
    if (runtime !== 'object-records' || !objectDefinition || getAccessToken() === null) {
      setRecords([]);
      setObjectFields([]);
      return;
    }
    let active = true;
    Promise.all([
      api.get<{ data: ObjectDefinition }>(
        `/object-definitions/${encodeURIComponent(objectDefinition)}`,
      ),
      api.get<{ data: ObjectRecord[] }>(
        `/object-definitions/${encodeURIComponent(objectDefinition)}/records?limit=100`,
      ),
    ])
      .then(([definition, list]) => {
        if (!active) return;
        setObjectFields(definition.data.fields);
        setRecords(list.data);
      })
      .catch(() => {
        if (!active) return;
        setRecords([]);
        setObjectFields([]);
      });
    return () => {
      active = false;
    };
  }, [objectDefinition, runtime]);

  const handleAction = useCallback(
    async (action: string, payload: unknown) => {
      if (runtime !== 'object-records' || objectDefinition === '' || !isRecord(payload)) return;
      const keys = resolveTodoFieldKeys(runtimeProps);
      const request =
        action === 'runtime:request'
          ? objectRecordsRequest(payload, objectDefinition)
          : legacyObjectRecordsRequest(action, payload, keys.title, keys.done);
      if (!request) return;
      if (request.kind === 'create') {
        const title = text(request.data?.[keys.title]).trim();
        if (title === '') return;
        try {
          const created = await api.post<{ data: ObjectRecord }>(
            `/object-definitions/${encodeURIComponent(objectDefinition)}/records`,
            {
              data: {
                ...buildNewRecordData(title, keys, objectFields, null),
                ...request.data,
              },
            },
          );
          setRecords((current) => [...current, created.data]);
        } catch {
          // The source remains rendered. Invalid records are rejected by the
          // Object API, whose validation is the authoritative contract.
        }
        return;
      }
      const id = request.id ?? '';
      const record = records.find((candidate) => candidate.id === id);
      if (!record) return;
      if (request.kind === 'update' && request.data) {
        const data = mergedRecordData(record, request.data);
        const previous = records;
        setRecords((current) =>
          current.map((candidate) => (candidate.id === id ? { ...candidate, data } : candidate)),
        );
        try {
          await api.patch(`/object-records/${encodeURIComponent(id)}`, { data });
        } catch {
          setRecords(previous);
        }
        return;
      }
      if (request.kind === 'delete') {
        const previous = records;
        setRecords((current) => current.filter((candidate) => candidate.id !== id));
        try {
          await api.del(`/object-records/${encodeURIComponent(id)}`);
        } catch {
          setRecords(previous);
        }
      }
    },
    [objectDefinition, objectFields, records, runtime, runtimeProps],
  );

  const output = useMemo(
    () =>
      renderedHtml(
        html,
        css,
        erc,
        props,
        {
          entries: runtime === 'content-entries' ? contentItems(entries, runtimeProps) : [],
          records:
            runtime === 'object-records' ? objectItems(records, runtimeProps, objectFields) : [],
        },
        sitePages,
        siteBasePath,
      ),
    [
      css,
      entries,
      erc,
      html,
      objectFields,
      props,
      records,
      runtime,
      runtimeProps,
      siteBasePath,
      sitePages,
    ],
  );

  if (js !== null && js !== undefined && js.trim() !== '') {
    return (
      <BlockScriptSandbox
        erc={erc}
        html={output.html}
        css={output.css}
        js={js}
        props={runtimeProps}
        onAction={handleAction}
      />
    );
  }

  return (
    <>
      {output.css !== '' ? <style dangerouslySetInnerHTML={{ __html: output.css }} /> : null}
      <div data-nv-b={erc} dangerouslySetInnerHTML={{ __html: output.html }} />
    </>
  );
}
