'use client';

import Link from 'next/link';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button, Field, FormActions } from '../../../components/form';
import type { ApiError } from '../../../lib/api';

export interface SiteFormValues {
  name: string;
  slug: string;
  description: string;
}

// class-validator messages start with the property name ("slug must match ...").
function fieldError(error: ApiError | null, field: string): string | null {
  const messages = error?.problem.errors ?? [];
  return messages.find((message) => message.toLowerCase().startsWith(field)) ?? null;
}

export function SiteForm({
  initial,
  busy,
  error,
  submitLabel,
  onSubmit,
  children,
}: {
  initial?: SiteFormValues;
  busy: boolean;
  error: ApiError | null;
  submitLabel: string;
  onSubmit: (values: SiteFormValues) => void;
  children?: ReactNode;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ name, slug, description });
  }

  return (
    <form className="nv-form" onSubmit={handleSubmit}>
      {error ? <div className="nv-error">{error.message}</div> : null}
      {children}
      <Field label="Name" htmlFor="name" error={fieldError(error, 'name')}>
        <input
          id="name"
          type="text"
          required
          maxLength={255}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Slug" htmlFor="slug" error={fieldError(error, 'slug')}>
        <input
          id="slug"
          type="text"
          required
          maxLength={100}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          title="Lowercase letters and digits separated by single hyphens"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </Field>
      <Field label="Description" htmlFor="description" error={fieldError(error, 'description')}>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <FormActions>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
        <Link className="nv-button" data-variant="secondary" href="/admin/sites">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
