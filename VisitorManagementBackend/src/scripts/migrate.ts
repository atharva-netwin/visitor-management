#!/usr/bin/env ts-node

import { migrator, db } from '../database';
import { logger } from '../utils/logger';

async function runMigrations() {
    try {
        logger.info('Starting migration script...');

        // Connect to database
        await db.connect();

        // Ensure migrations table exists first
        await migrator.createMigrationsTable();

        // Get migration status
        const status = await migrator.getMigrationStatus();
        logger.info('Migration status:', status);

        // Run migrations
        await migrator.runMigrations();

        // Get updated status
        const updatedStatus = await migrator.getMigrationStatus();
        logger.info('Updated migration status:', updatedStatus);

        logger.info('Migration script completed successfully');
    } catch (error) {
        logger.error('Migration script failed:', error);
        process.exit(1);
    } finally {
        await db.disconnect();
    }
}

// Handle command line arguments
const command = process.argv[2];

switch (command) {
    case 'status':
        (async () => {
            try {
                await db.connect();
                await migrator.createMigrationsTable();
                const status = await migrator.getMigrationStatus();
                console.log('Migration Status:');
                console.log(`  Executed: ${status.executed.join(', ') || 'None'}`);
                console.log(`  Available: ${status.available.join(', ') || 'None'}`);
                console.log(`  Pending: ${status.pending.join(', ') || 'None'}`);
            } catch (error) {
                logger.error('Failed to get migration status:', error);
                process.exit(1);
            } finally {
                await db.disconnect();
            }
        })();
        break;

    case 'rollback':
        const migrationIdArg = process.argv[3];
        if (!migrationIdArg) {
            console.error('Usage: npm run migrate rollback <migration_id>');
            process.exit(1);
        }
        const migrationId = parseInt(migrationIdArg, 10);
        if (isNaN(migrationId)) {
            console.error('Migration ID must be a valid number');
            process.exit(1);
        }
        (async () => {
            try {
                await db.connect();
                await migrator.rollbackMigration(migrationId);
                logger.info(`Migration ${migrationId} rolled back successfully`);
            } catch (error) {
                logger.error('Rollback failed:', error);
                process.exit(1);
            } finally {
                await db.disconnect();
            }
        })();
        break;

    default:
        runMigrations();
}