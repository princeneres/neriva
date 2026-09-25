import { apiUrl } from '../api-url';

// The two ways a rendered page can reach Object records.
//
// A signed-in visitor keeps using the management endpoints, so the runtime
// block behaves exactly like the admin screens and obeys the visitor's own
// role. An anonymous visitor uses /public/object-definitions/<ref>, which only
// answers for definitions an administrator explicitly published (spec 05).
//
// Kept out of the component so the web suite can unit test it: only
// apps/web/lib/**/*.spec.ts(x) runs.

export interface GatewayObjectDefinition {
  fields: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'date' | 'picklist';
    required: boolean;
    options?: string[];
  }[];
  // Absent on the authenticated surface, where the visitor's role decides.
  publicAccess?: 'read' | 'read-write';
}

export interface GatewayObjectRecord {
  id: string;
  externalReferenceCode: string;
  data: Record<string, unknown>;
}

// The subset of lib/api.ts the gateway needs, injected so a test can drive it
// without a browser and without localStorage.
export interface AuthenticatedClient {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body: unknown) => Promise<T>;
  del: (path: string) => Promise<undefined>;
}

export interface ObjectRecordsGateway {
  loadDefinition: () => Promise<GatewayObjectDefinition>;
  listRecords: (limit: number) => Promise<GatewayObjectRecord[]>;
  createRecord: (data: Record<string, unknown>) => Promise<GatewayObjectRecord>;
  updateRecord: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
}

class PublicRequestError extends Error {
  constructor(readonly status: number) {
    super(`Public object request failed with status ${status}`);
    this.name = 'PublicRequestError';
  }
}

async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new PublicRequestError(response.status);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

function authenticatedGateway(
  client: AuthenticatedClient,
  definitionRef: string,
): ObjectRecordsGateway {
  const base = `/object-definitions/${encodeURIComponent(definitionRef)}`;
  return {
    loadDefinition: async () => (await client.get<{ data: GatewayObjectDefinition }>(base)).data,
    listRecords: async (limit) =>
      (await client.get<{ data: GatewayObjectRecord[] }>(`${base}/records?limit=${limit}`)).data,
    createRecord: async (data) =>
      (await client.post<{ data: GatewayObjectRecord }>(`${base}/records`, { data })).data,
    updateRecord: async (id, data) => {
      await client.patch(`/object-records/${encodeURIComponent(id)}`, { data });
    },
    deleteRecord: async (id) => {
      await client.del(`/object-records/${encodeURIComponent(id)}`);
    },
  };
}

function anonymousGateway(definitionRef: string): ObjectRecordsGateway {
  const base = `/public/object-definitions/${encodeURIComponent(definitionRef)}`;
  // Records hang off the definition here, unlike the management API: the
  // public surface has no bare /object-records/:id, so one published object
  // never becomes a handle on another one's records.
  const record = (id: string) => `${base}/records/${encodeURIComponent(id)}`;
  return {
    loadDefinition: async () => (await publicRequest<{ data: GatewayObjectDefinition }>(base)).data,
    listRecords: async (limit) =>
      (await publicRequest<{ data: GatewayObjectRecord[] }>(`${base}/records?limit=${limit}`)).data,
    createRecord: async (data) =>
      (
        await publicRequest<{ data: GatewayObjectRecord }>(`${base}/records`, {
          method: 'POST',
          body: JSON.stringify({ data }),
        })
      ).data,
    updateRecord: async (id, data) => {
      await publicRequest(record(id), { method: 'PATCH', body: JSON.stringify({ data }) });
    },
    deleteRecord: async (id) => {
      await publicRequest(record(id), { method: 'DELETE' });
    },
  };
}

export function objectRecordsGateway(
  definitionRef: string,
  accessToken: string | null,
  client: AuthenticatedClient,
): ObjectRecordsGateway {
  return accessToken === null
    ? anonymousGateway(definitionRef)
    : authenticatedGateway(client, definitionRef);
}
