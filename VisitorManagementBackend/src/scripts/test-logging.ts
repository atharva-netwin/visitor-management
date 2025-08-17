#!/usr/bin/env ts-node

/**
 * Script to demonstrate the structured logging system
 * Run with: npm run test:logging
 */

// Set environment variables for testing
process.env['NODE_ENV'] = 'development';
process.env['LOG_LEVEL'] = 'debug';

import { 
  logWithCorrelation, 
  logSystemEvent, 
  logSecurityEvent, 
  logApiEvent, 
  logDatabaseEvent, 
  logPerformance 
} from '../utils/logger';
import { ensureLogsDirectory, getLogStats } from '../utils/logSetup';

async function demonstrateLogging() {
  console.log('🚀 Demonstrating Structured Logging System\n');

  // Ensure logs directory exists
  await ensureLogsDirectory();

  // Generate a correlation ID for this demo
  const correlationId = 'demo-' + Date.now();

  console.log('1. Basic logging with correlation ID:');
  logWithCorrelation.info('Demo started', { feature: 'logging-demo' }, correlationId);
  
  console.log('2. System events:');
  logSystemEvent('demo_system_event', { 
    component: 'logging-demo',
    version: '1.0.0' 
  }, correlationId);

  console.log('3. Security events:');
  logSecurityEvent('demo_security_event', {
    ip: '127.0.0.1',
    userAgent: 'Demo-Script/1.0',
    severity: 'low'
  }, correlationId);

  console.log('4. API events:');
  logApiEvent('demo_api_request', {
    method: 'GET',
    endpoint: '/api/demo',
    statusCode: 200,
    responseTime: 150
  }, correlationId);

  console.log('5. Database events:');
  logDatabaseEvent('demo_query_executed', {
    table: 'demo_table',
    operation: 'SELECT',
    duration: 25,
    rowsAffected: 10
  }, correlationId);

  console.log('6. Performance logging:');
  // Fast operation
  logPerformance('fast_operation', 50, { type: 'cache_hit' }, correlationId);
  // Slow operation
  logPerformance('slow_operation', 2500, { type: 'database_query' }, correlationId);
  // Very slow operation
  logPerformance('very_slow_operation', 6000, { type: 'external_api' }, correlationId);

  console.log('7. Error logging:');
  const demoError = new Error('Demo error for testing');
  logWithCorrelation.error('Demo error occurred', demoError, {
    context: 'logging-demo',
    severity: 'medium'
  }, correlationId);

  console.log('8. Warning with context:');
  logWithCorrelation.warn('Demo warning', {
    reason: 'demonstration',
    action: 'no_action_required'
  }, correlationId);

  // Get log statistics
  console.log('\n📊 Log Statistics:');
  const stats = await getLogStats();
  console.log(`Total log files: ${stats.totalFiles}`);
  console.log(`Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
  console.log(`Oldest file: ${stats.oldestFile || 'None'}`);
  console.log(`Newest file: ${stats.newestFile || 'None'}`);

  logWithCorrelation.info('Demo completed successfully', { 
    duration: 'immediate',
    correlationId 
  }, correlationId);

  console.log('\n✅ Logging demonstration complete!');
  console.log('Check the logs/ directory for generated log files.');
  console.log('In production, logs will be automatically rotated and archived.');
}

// Run the demonstration
demonstrateLogging().catch(error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});