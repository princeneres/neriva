'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '../../../../../../components/toast';
import { ApiError, api } from '../../../../../../lib/api';
import { RecordForm } from '../../../record-form';
import type { ObjectDefinition, ObjectRecord } from '../../../types';

export default function NewObjectRecordPage() {
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

  async function onSubmit(data: Record<string, unknown>) {
    await api.post<{ data: ObjectRecord }>(`/object-definitions/${id}/records`, { data });
    toast.success('Record created');
    router.push(`/admin/objects/${id}/records`);
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>{definition ? `New ${definition.name} record` : 'New record'}</h1>
      </div>
      <div className="nv-card">
        <div className="nv-card-body">
          {loadError ? <div className="nv-error">{loadError}</div> : null}
          {!definition && !loadError ? <p>Loading…</p> : null}
          {definition ? (
            <RecordForm
              definition={definition}
              submitLabel="Create record"
              busyLabel="Creating…"
              onSubmit={onSubmit}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
