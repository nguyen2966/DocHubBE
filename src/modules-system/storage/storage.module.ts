// src/modules-system/storage/storage.module.ts
import { Module } from '@nestjs/common';
import { StorageContract } from './storage.contract';
import { LocalStorageProvider } from './providers/local.storage.provider';

@Module({
  providers: [
    {
      provide: StorageContract,
      useClass: LocalStorageProvider,
    },
  ],
  exports: [StorageContract],
})
export class StorageModule {}

/*
 * To switch providers in the future, replace `useClass` with the desired
 * implementation (S3StorageProvider, MinIOStorageProvider, etc.).
 * No other module needs to change.
 *
 * Example:
 *   { provide: StorageContract, useClass: S3StorageProvider }
 */