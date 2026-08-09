'use client';

import { notifications } from '@mantine/notifications';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ApiError, api } from '../../../../lib/api';
import { TemplateStudio, type TemplateStudioValues } from '../template-studio';
import { defaultTreeFor, type PageTemplate, type PageTemplateKind } from '../types';

function kindFromParam(raw: string | null): PageTemplateKind {
  return raw === 'MASTER' ? 'MASTER' : 'STANDARD';
}

// New page templates are created directly in the studio: name the template
// in the top bar and Save creates it, then the editor keeps working against
// the created record (PATCH from here on happens on /admin/page-templates/[id]).
function NewTemplateStudio() {
  const router = useRouter();
  const kind = kindFromParam(useSearchParams().get('kind'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onSave(values: TemplateStudioValues) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ data: PageTemplate }>('/page-templates', {
        name: values.name,
        kind,
        tree: values.tree,
      });
      notifications.show({ color: 'green', message: `"${data.name}" was created.` });
      router.replace(`/admin/page-templates/${data.id}`);
    } catch (err) {
      const apiError =
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' });
      setError(apiError);
      notifications.show({
        color: 'red',
        title: 'The template could not be created',
        message: apiError.message,
        autoClose: 10000,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <TemplateStudio
      kind={kind}
      initialName=""
      initialTree={defaultTreeFor(kind)}
      backHref="/admin/page-templates"
      busy={busy}
      serverError={error}
      onSave={(values) => void onSave(values)}
    />
  );
}

export default function NewPageTemplatePage() {
  return (
    <Suspense fallback={null}>
      <NewTemplateStudio />
    </Suspense>
  );
}
