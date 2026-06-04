// token.type.ts
export interface TokenPayload {
  sub: string   // userId
  jti: string   // dùng để revoke access token
  exp: number   // unix timestamp, dùng để tính expiresAt khi revoke
  iat: number
}