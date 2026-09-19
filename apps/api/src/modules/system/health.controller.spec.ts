import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { DB } from '../../db/database';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports ok', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DB, useValue: { execute: async () => undefined } }],
    }).compile();

    const controller = moduleRef.get(HealthController);
    expect(controller.check()).toEqual({ status: 'ok' });
  });

  it('reports readiness when the database responds', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DB, useValue: { execute: async () => undefined } }],
    }).compile();

    await expect(moduleRef.get(HealthController).ready()).resolves.toEqual({ status: 'ok' });
  });

  it('reports unavailable when the database cannot be reached', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DB,
          useValue: {
            execute: async () => {
              throw new Error('down');
            },
          },
        },
      ],
    }).compile();

    await expect(moduleRef.get(HealthController).ready()).rejects.toMatchObject({
      status: 503,
    });
  });
});
