import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { JWT_EXPIRES_IN, JWT_SECRET } from 'src/common/constants/app.constants';
import type { StringValue } from 'ms';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: JWT_SECRET,
        signOptions: { expiresIn: JWT_EXPIRES_IN as StringValue},
      }),
    }),
  ],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}