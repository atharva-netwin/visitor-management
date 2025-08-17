// Database module exports
export { db, pool } from './connection';
export { migrator } from './migrator';

// Database initialization function
export async function initializeDatabase(): Promise<void> {
  const { db } = await import('./connection');
  const { migrator } = await import('./migrator');
  await db.connect();
  await migrator.runMigrations();
}