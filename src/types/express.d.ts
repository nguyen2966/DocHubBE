import { TokenPayload } from 'src/modules-system/token/token.type';

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string
        email: string
        fullName: string
        isEmailVerified: boolean
      }
      tokenPayload?: TokenPayload
    }
  }
}

export {}