import { Module } from '@nestjs/common'
import { STORAGE_PROVIDER } from 'src/common/constants/app.constants'
import { StorageContract } from './storage.contract'
import { LocalStorageProvider } from './providers/local.storage.provider'
import { CloudinaryStorageProvider } from './providers/cloudinary.storage.provider'

@Module({
  providers: [
    LocalStorageProvider,
    CloudinaryStorageProvider,
    {
      provide: StorageContract,
      useFactory: (
        localStorageProvider: LocalStorageProvider,
        cloudinaryStorageProvider: CloudinaryStorageProvider,
      ): StorageContract => {
        if (STORAGE_PROVIDER === 'cloudinary') {
          return cloudinaryStorageProvider
        }

        return localStorageProvider
      },
      inject: [LocalStorageProvider, CloudinaryStorageProvider],
    },
  ],
  exports: [StorageContract],
})
export class StorageModule {}