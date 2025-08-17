#!/usr/bin/env ts-node

/**
 * Database Connection Test Script
 * Tests the database connection and verifies table structure
 */

import { db } from '../database';
import { logger } from '../utils/logger';

async function testDatabaseConnection(): Promise<void> {
  try {
    logger.info('Testing database connection...');
    
    // Test basic connection
    await db.connect();
    logger.info('✅ Database connection successful');
    
    // Test health check
    const health = await db.healthCheck();
    logger.info('Database health check:', health);
    
    // Verify tables exist
    const tablesQuery = `
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'visitors', 'refresh_tokens')
      ORDER BY table_name;
    `;
    
    const tablesResult = await db.query(tablesQuery);
    
    if (tablesResult.rows.length === 3) {
      logger.info('✅ All required tables found:');
      tablesResult.rows.forEach(row => {
        logger.info(`  - ${row.table_name}`);
      });
    } else {
      logger.warn(`⚠️  Expected 3 tables, found ${tablesResult.rows.length}`);
      logger.info('Found tables:', tablesResult.rows);
    }
    
    // Test table structure for users table
    const usersStructureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    const usersStructure = await db.query(usersStructureQuery);
    logger.info('✅ Users table structure:');
    usersStructure.rows.forEach(col => {
      logger.info(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Test indexes
    const indexesQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename IN ('users', 'visitors', 'refresh_tokens')
      AND schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    
    const indexesResult = await db.query(indexesQuery);
    logger.info(`✅ Found ${indexesResult.rows.length} indexes`);
    
    // Test a simple insert and delete (to verify permissions)
    logger.info('Testing database permissions...');
    
    const testEmail = `test-${Date.now()}@example.com`;
    const insertQuery = `
      INSERT INTO users (email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;
    
    const insertResult = await db.query(insertQuery, [
      testEmail,
      'test-hash',
      'Test',
      'User'
    ]);
    
    const testUserId = insertResult.rows[0].id;
    logger.info('✅ Insert permission verified');
    
    // Clean up test data
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    logger.info('✅ Delete permission verified');
    
    logger.info('🎉 Database setup verification completed successfully!');
    
  } catch (error) {
    logger.error('❌ Database connection test failed:', error);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testDatabaseConnection()
    .then(() => {
      logger.info('Database connection test completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Database connection test failed:', error);
      process.exit(1);
    });
}

export { testDatabaseConnection };