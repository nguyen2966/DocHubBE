import Redis from 'ioredis';
import { Provider } from '@nestjs/common';
import { REDIS_CLIENT } from 'src/common/constants/app.constants';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      // password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });
  },
};