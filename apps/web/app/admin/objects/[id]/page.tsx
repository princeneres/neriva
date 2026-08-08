'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Field } from '../../../../components/form';
import { useToast } from '../../../../components/toast';
import { ApiError, api } from '../../../../lib/api';
import { DefinitionForm, type DefinitionFormValues } from '../definition-form';
import type { ObjectDefinition } from '../types';

export default function EditObjectDefinitionPage() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [definition, setDefinition] = useState<ObjectDefinition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: ObjectDefinition }>(`/object-definitions/${id}`)
      .then(({ data }) => setDefinition(data))
      .catch((err: unknown) => {
        setLoadError(
          err instanceof ApiError ? err.message : 'Failed to load the object definition',
        );
      });
  }, [id]);

  async function onSubmit(values: DefinitionFormValues) {
    const description = values.description.trim();
    await api.patch<{ data: ObjectDefinition }>(`/object-definitions/${id}`, {
      name: values.name,
      pluralName: values.pluralName,
      description: description === '' ? null : description,
      fields: values.fields,
    });
    toast.success('Object definition updated');
    router.push('/admin/objects');
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Edit object definition</h1>
      </div>
      <div className="nv-card">
        <div className="nv-card-body">
          {loadError ? <div className="nv-error">{loadError}</div> : null}
          {!definition && !loadError ? <p>Loading…</p> : null}
          {definition ? (
            <DefinitionForm
              initial={{
                name: definition.name,
                pluralName: definition.pluralName,
                description: definition.description ?? '',
                fields: definition.fields,
              }}
              submitLabel="Save changes"
              busyLabel="Saving…"
              onSubmit={onSubmit}
            >
              <Field label="ID">
                <span className="nv-code">{definition.id}</span>
              </Field>
              <Field label="External reference code">
                <span className="nv-code">{definition.externalReferenceCode}</span>
              </Field>
            </DefinitionForm>
          ) : null}
        </div>
      </div>
    </>
  );
}
