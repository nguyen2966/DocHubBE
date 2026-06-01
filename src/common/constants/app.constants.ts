import "dotenv/config";

export const MONGO_URL = process.env.MONGO_URL;
export const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

export const ACCESS_TOKEN_DURATION = process.env.ACCESS_TOKEN_DURATION;
export const REFRESH_TOKEN_DURATION = process.env.REFRESH_TOKEN_DURATION;