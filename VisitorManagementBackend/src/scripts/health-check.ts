#!/usr/bin/env node

/**
 * Health Check Script
 * Can be used by monitoring services or load balancers
 */

import http from 'http';
import { logger } from '../utils/logger';

interface HealthCheckOptions {
  host?: string;
  port?: number;
  path?: string;
  timeout?: number;
}

async function healthCheck(options: HealthCheckOptions = {}): Promise<void> {
  const {
    host = 'localhost',
    port = parseInt(process.env['PORT'] || '3000', 10),
    path = '/api/health',
    timeout = 10000
  } = options;

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host,
      port,
      path,
      method: 'GET',
      timeout
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const healthData = JSON.parse(data);
          
          if (res.statusCode === 200 && healthData.status === 'healthy') {
            logger.info('✅ Health check passed', {
              statusCode: res.statusCode,
              status: healthData.status,
              timestamp: healthData.timestamp
            });
            resolve();
          } else {
            logger.error('❌ Health check failed', {
              statusCode: res.statusCode,
              response: healthData
            });
            reject(new Error(`Health check failed: ${res.statusCode}`));
          }
        } catch (error) {
          logger.error('❌ Health check response parsing failed', {
            statusCode: res.statusCode,
            response: data,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      logger.error('❌ Health check request failed', {
        error: error.message,
        host,
        port,
        path
      });
      reject(error);
    });
    
    req.on('timeout', () => {
      logger.error('❌ Health check timed out', {
        timeout,
        host,
        port,
        path
      });
      req.destroy();
      reject(new Error(`Health check timed out after ${timeout}ms`));
    });
    
    req.end();
  });
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: HealthCheckOptions = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    
    if (!value) continue; // Skip if no value provided
    
    switch (key) {
      case '--host':
        options.host = value;
        break;
      case '--port':
        options.port = parseInt(value, 10);
        break;
      case '--path':
        options.path = value;
        break;
      case '--timeout':
        options.timeout = parseInt(value, 10);
        break;
    }
  }
  
  healthCheck(options)
    .then(() => {
      console.log('Health check passed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Health check failed:', error.message);
      process.exit(1);
    });
}

export { healthCheck };