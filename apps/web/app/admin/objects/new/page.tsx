'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '../../../../components/toast';
import { api } from '../../../../lib/api';
import { DefinitionForm, type DefinitionFormValues } from '../definition-form';
import type { ObjectDefinition } from '../types';

export default function NewObjectDefinitionPage() {
  const router = useRouter();
  const toast = useToast();

  async function onSubmit(values: DefinitionFormValues) {
    const description = values.description.trim();
    await api.post<{ data: ObjectDefinition }>('/object-definitions', {
      name: values.name,
      pluralName: values.pluralName,
      ...(description ? { description } : {}),
      fields: values.fields,
    });
    toast.success('Object definition created');
    router.push('/admin/objects');
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>New object definition</h1>
      </div>
      <div className="nv-card">
        <div className="nv-card-body">
          <DefinitionForm
            submitLabel="Create definition"
            busyLabel="Creating…"
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </>
  );
}
