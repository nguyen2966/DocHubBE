import { Injectable } from '@nestjs/common';
import * as jwt from "jsonwebtoken";
import { TokenPayload } from "./token.type";
import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_DURATION, REFRESH_TOKEN_DURATION } from "src/common/constants/app.constants";

@Injectable()
export class TokenService {
  createAccessToken(userId: string) {
    const accessToken = jwt.sign({ userId: userId }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_DURATION });

    return accessToken;
  }

  createRefreshToken(userId: string) {
    const refreshToken = jwt.sign({ userId: userId }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_DURATION });

    return refreshToken;
  }

  verifyAccessToken(acccessToken: string, option?: jwt.VerifyOptions): TokenPayload {
    const decode = jwt.verify(acccessToken, ACCESS_TOKEN_SECRET , option) as TokenPayload;
    return decode;
  }
  verifyRefreshToken(refreshToken: string, option?: jwt.VerifyOptions): TokenPayload {
    const decode = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET , option) as TokenPayload;
    return decode;
  }
}
