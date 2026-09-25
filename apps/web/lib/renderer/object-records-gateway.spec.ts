import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  objectRecordsGateway,
  type AuthenticatedClient,
  type GatewayObjectRecord,
} from './object-records-gateway';

const RECORD: GatewayObjectRecord = { id: 'r1', externalReferenceCode: 'erc-1', data: {} };

function stubClient(): AuthenticatedClient & { calls: [string, string, unknown][] } {
  const calls: [string, string, unknown][] = [];
  return {
    calls,
    get: <T>(path: string) => {
      calls.push(['GET', path, undefined]);
      return Promise.resolve({ data: [] } as T);
    },
    post: <T>(path: string, body?: unknown) => {
      calls.push(['POST', path, body]);
      return Promise.resolve({ data: RECORD } as T);
    },
    patch: <T>(path: string, body: unknown) => {
      calls.push(['PATCH', path, body]);
      return Promise.resolve({ data: RECORD } as T);
    },
    del: (path: string) => {
      calls.push(['DELETE', path, undefined]);
      return Promise.resolve(undefined);
    },
  };
}

function stubFetch(status = 200, body: unknown = { data: RECORD }) {
  const fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('objectRecordsGateway', () => {
  it('uses the management endpoints when a token is present', async () => {
    const client = stubClient();
    const gateway = objectRecordsGateway('erc:demo-task', 'token', client);
    await gateway.loadDefinition();
    await gateway.listRecords(100);
    await gateway.createRecord({ title: 'x' });
    await gateway.updateRecord('r1', { title: 'y' });
    await gateway.deleteRecord('r1');
    expect(client.calls.map(([method, path]) => `${method} ${path}`)).toEqual([
      'GET /object-definitions/erc%3Ademo-task',
      'GET /object-definitions/erc%3Ademo-task/records?limit=100',
      'POST /object-definitions/erc%3Ademo-task/records',
      'PATCH /object-records/r1',
      'DELETE /object-records/r1',
    ]);
  });

  it('uses the public endpoints, with no Authorization header, when there is no token', async () => {
    const fetchMock = stubFetch();
    const client = stubClient();
    const gateway = objectRecordsGateway('erc:demo-task', null, client);
    await gateway.loadDefinition();
    await gateway.createRecord({ title: 'x' });
    expect(client.calls).toEqual([]);
    const [definitionCall, createCall] = fetchMock.mock.calls as unknown as [
      [string, RequestInit],
      [string, RequestInit],
    ];
    expect(definitionCall[0]).toContain('/public/object-definitions/erc%3Ademo-task');
    expect(createCall[0]).toContain('/public/object-definitions/erc%3Ademo-task/records');
    expect(createCall[1].method).toBe('POST');
    expect(JSON.stringify(createCall[1].headers)).not.toContain('authorization');
  });

  it('addresses a public record under its definition, never as a bare object record', async () => {
    const fetchMock = stubFetch(204, undefined);
    const gateway = objectRecordsGateway('erc:demo-task', null, stubClient());
    await gateway.deleteRecord('r1');
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/public/object-definitions/erc%3Ademo-task/records/r1');
    expect(url).not.toContain('/object-records/');
  });

  it('rejects when the public surface refuses the definition', async () => {
    stubFetch(404, {});
    const gateway = objectRecordsGateway('erc:private-object', null, stubClient());
    await expect(gateway.loadDefinition()).rejects.toThrow('404');
  });
});
