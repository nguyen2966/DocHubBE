import "dotenv/config";

export const MONGO_URL = process.env.MONGO_URL;

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
export const REFRESH_TOKEN_TTL_DAYS = process.env.REFRESH_TOKEN_TTL_DAYS;

export const EMAIL_VERIFY_TTL_MINUTES= process.env.EMAIL_VERIFY_TTL_MINUTES;

export const APP_URL = process.env.APP_URL;
export const APP_CLIENT_URL = process.env.APP_CLIENT_URL;

export const REDIS_URL = process.env.REDIS_URL;

export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = process.env.SMTP_PORT;
export const SMTP_SECURE = process.env.SMTP_SECURE;
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS= process.env.SMTP_PASS;
export const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME;
export const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS;

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_HOST = process.env.REDIS_HOST;
export const REDIS_PORT = process.env.REDIS_PORT;
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

