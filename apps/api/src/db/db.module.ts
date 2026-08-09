import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';
import { createDatabase, createPool, DB, PG_POOL, type Database } from './database';
import { DemoSeedService } from './demo-seed.service';
import { NativeMasterPageSeedService } from './native-master-page-seed.service';
import { SeedService } from './seed.service';

// useFactory providers get no lifecycle hooks, so this closes the pool when
// the app shuts down (enableShutdownHooks / app.close in tests).
@Injectable()
class PoolLifecycle implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        const url = process.env.DATABASE_URL;
        if (!url) {
          throw new Error('DATABASE_URL is not set');
        }
        return createPool(url);
      },
    },
    {
      provide: DB,
      useFactory: (pool: Pool): Database => createDatabase(pool),
      inject: [PG_POOL],
    },
    PoolLifecycle,
    SeedService,
    DemoSeedService,
    NativeMasterPageSeedService,
  ],
  // PG_POOL is exported so the objects module can build its Kysely instance
  // over the same pool (spec 05).
  exports: [DB, PG_POOL],
})
export class DbModule {}
