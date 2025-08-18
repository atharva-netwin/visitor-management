

import fs from 'fs/promises';
import path from 'path';
import { db } from './connection';
import { logger } from '../utils/logger';

interface Migration {
  id: number;
  filename: string;
  sql: string;
}

class DatabaseMigrator {
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  async createMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await db.query(createTableSQL);
      logger.info('Migrations table created or already exists');
    } catch (error) {
      logger.error('Failed to create migrations table:', error);
      throw error;
    }
  }

  async getExecutedMigrations(): Promise<number[]> {
    try {
      const result = await db.query<{ id: number }>('SELECT id FROM migrations ORDER BY id');
      return result.rows.map(row => row.id);
    } catch (error) {
      logger.error('Failed to get executed migrations:', error);
      throw error;
    }
  }

  async getMigrationFiles(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();

      const migrations: Migration[] = [];

      for (const filename of migrationFiles) {
        const match = filename.match(/^(\d+)_/);
        if (!match) {
          logger.warn(`Skipping migration file with invalid format: ${filename}`);
          continue;
        }

        const id = parseInt(match[1]!, 10);
        const filePath = path.join(this.migrationsPath, filename);
        const sql = await fs.readFile(filePath, 'utf-8');

        migrations.push({ id, filename, sql });
      }

      return migrations;
    } catch (error) {
      logger.error('Failed to read migration files:', error);
      throw error;
    }
  }

  async executeMigration(migration: Migration): Promise<void> {
    try {
      await db.transaction(async (client) => {
        // Execute the migration SQL
        await client.query(migration.sql);
        
        // Record the migration as executed
        await client.query(
          'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
          [migration.id, migration.filename]
        );
      });

      logger.info(`Migration ${migration.filename} executed successfully`);
    } catch (error) {
      logger.error(`Failed to execute migration ${migration.filename}:`, error);
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations...');

      // Ensure migrations table exists
      await this.createMigrationsTable();

      // Get executed migrations and available migration files
      const [executedMigrations, availableMigrations] = await Promise.all([
        this.getExecutedMigrations(),
        this.getMigrationFiles()
      ]);

      // Find pending migrations
      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration.id)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations found');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      // Execute pending migrations in order
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration process failed:', error);
      throw error;
    }
  }

  async rollbackMigration(migrationId: number): Promise<void> {
    try {
      // Note: This is a basic rollback that just removes the migration record
      // In a production system, you'd want to have rollback SQL scripts
      await db.query('DELETE FROM migrations WHERE id = $1', [migrationId]);
      logger.info(`Migration ${migrationId} rolled back (record removed)`);
    } catch (error) {
      logger.error(`Failed to rollback migration ${migrationId}:`, error);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<{ executed: number[]; available: number[]; pending: number[] }> {
    try {
      const [executedMigrations, availableMigrations] = await Promise.all([
        this.getExecutedMigrations(),
        this.getMigrationFiles()
      ]);

      const availableIds = availableMigrations.map(m => m.id);
      const pendingIds = availableIds.filter(id => !executedMigrations.includes(id));

      return {
        executed: executedMigrations,
        available: availableIds,
        pending: pendingIds
      };
    } catch (error) {
      logger.error('Failed to get migration status:', error);
      throw error;
    }
  }
}

export const migrator = new DatabaseMigrator();