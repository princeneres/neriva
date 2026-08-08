'use client';

import Link from 'next/link';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button, Field, FormActions } from '../../../components/form';
import type { ApiError } from '../../../lib/api';
import { TreeEditor } from './tree-editor';
import { EMPTY_TREE_TEXT, PATH_PATTERN, parseTree, type PageTree } from './tree-utils';

export interface PageFormValues {
  title: string;
  path: string;
  tree: PageTree;
}

// class-validator messages start with the property name ("path must match ...").
function fieldError(error: ApiError | null, field: string): string | null {
  const messages = error?.problem.errors ?? [];
  return messages.find((message) => message.toLowerCase().startsWith(field)) ?? null;
}

export function PageForm({
  initial,
  initialTreeText,
  busy,
  error,
  submitLabel,
  onSubmit,
  children,
}: {
  initial?: { title: string; path: string };
  initialTreeText?: string;
  busy: boolean;
  error: ApiError | null;
  submitLabel: string;
  onSubmit: (values: PageFormValues) => void;
  children?: ReactNode;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [path, setPath] = useState(initial?.path ?? '/');
  const [treeText, setTreeText] = useState(initialTreeText ?? EMPTY_TREE_TEXT);
  const [pathError, setPathError] = useState<string | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPathError(null);
    setTreeError(null);
    if (!PATH_PATTERN.test(path)) {
      setPathError('Path must start with "/" and use lowercase letters, digits, "/" and "-".');
      return;
    }
    const parsed = parseTree(treeText);
    if (!parsed.ok) {
      setTreeError(parsed.error);
      return;
    }
    onSubmit({ title: title.trim(), path, tree: parsed.tree });
  }

  return (
    <form className="nv-form" onSubmit={handleSubmit}>
      {error ? <div className="nv-error">{error.message}</div> : null}
      {children}
      <Field label="Title" htmlFor="title" error={fieldError(error, 'title')}>
        <input
          id="title"
          type="text"
          required
          maxLength={255}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Path" htmlFor="path" error={pathError ?? fieldError(error, 'path')}>
        <input
          id="path"
          type="text"
          required
          maxLength={255}
          placeholder="/home"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
      </Field>
      <Field label="Tree">
        <TreeEditor value={treeText} onChange={setTreeText} error={treeError} disabled={busy} />
      </Field>
      <FormActions>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
        <Link className="nv-button" data-variant="secondary" href="/admin/pages">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
