// Cache module exports
export { redis } from './redis';
export { sessionManager, type SessionData, type RefreshTokenData } from './sessionManager';

// Cache initialization function
export async function initializeCache(): Promise<void> {
  const { redis } = await import('./redis');
  await redis.connect();
}