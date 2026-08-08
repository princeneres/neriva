'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Field } from '../../../../../components/form';
import { useToast } from '../../../../../components/toast';
import { ApiError, api } from '../../../../../lib/api';
import { RecordForm, initialRecordValues } from '../../record-form';
import type { ObjectDefinition, ObjectRecord } from '../../types';

export default function EditObjectRecordPage() {
  const router = useRouter();
  const toast = useToast();
  const { recordId } = useParams<{ recordId: string }>();
  const [record, setRecord] = useState<ObjectRecord | null>(null);
  const [definition, setDefinition] = useState<ObjectDefinition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: ObjectRecord }>(`/object-records/${recordId}`)
      .then(async ({ data }) => {
        setRecord(data);
        const definitionResponse = await api.get<{ data: ObjectDefinition }>(
          `/object-definitions/${data.objectDefinitionId}`,
        );
        setDefinition(definitionResponse.data);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load the record');
      });
  }, [recordId]);

  async function onSubmit(data: Record<string, unknown>) {
    await api.patch<{ data: ObjectRecord }>(`/object-records/${recordId}`, { data });
    toast.success('Record updated');
    router.push(`/admin/objects/${definition?.id}/records`);
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>{definition ? `Edit ${definition.name} record` : 'Edit record'}</h1>
      </div>
      <div className="nv-card">
        <div className="nv-card-body">
          {loadError ? <div className="nv-error">{loadError}</div> : null}
          {!(record && definition) && !loadError ? <p>Loading…</p> : null}
          {record && definition ? (
            <>
              <Field label="ID">
                <span className="nv-code">{record.id}</span>
              </Field>
              <Field label="External reference code">
                <span className="nv-code">{record.externalReferenceCode}</span>
              </Field>
              <RecordForm
                definition={definition}
                initial={initialRecordValues(definition, record.data)}
                submitLabel="Save changes"
                busyLabel="Saving…"
                onSubmit={onSubmit}
              />
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
