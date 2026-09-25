import { Module } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../db/database';
import { ObjectDefinitionsController } from './object-definitions.controller';
import { ObjectDefinitionsService } from './object-definitions.service';
import { ObjectRecordsController } from './object-records.controller';
import { ObjectRecordsService } from './object-records.service';
import { PublicObjectsController } from './public-objects.controller';
import { PublicObjectsService } from './public-objects.service';
import { ResourceFoldersModule } from '../resource-folders/resource-folders.module';
import { createObjectsKysely, OBJECTS_KYSELY, type ObjectsKysely } from './objects.kysely';

@Module({
  imports: [ResourceFoldersModule],
  controllers: [ObjectDefinitionsController, ObjectRecordsController, PublicObjectsController],
  providers: [
    ObjectDefinitionsService,
    ObjectRecordsService,
    PublicObjectsService,
    {
      // Kysely over the same pg Pool as Drizzle (CLAUDE.md: Kysely only for
      // dynamic queries over runtime-defined Object fields).
      provide: OBJECTS_KYSELY,
      useFactory: (pool: Pool): ObjectsKysely => createObjectsKysely(pool),
      inject: [PG_POOL],
    },
  ],
  exports: [ObjectDefinitionsService, ObjectRecordsService],
})
export class ObjectsModule {}
