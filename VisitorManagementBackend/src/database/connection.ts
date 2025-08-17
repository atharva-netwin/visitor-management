import { Pool, PoolClient, PoolConfig } from 'pg';
import { config } from '../config/config';
import { logger } from '../utils/logger';

class DatabaseConnection {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    const poolConfig: PoolConfig = {
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.username,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      // Connection pool settings
      min: 2, // Minimum number of connections in pool
      max: 20, // Maximum number of connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
      // acquireTimeoutMillis: 60000, // This option doesn't exist in pg, using connectionTimeoutMillis instead
    };

    this.pool = new Pool(poolConfig);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', () => {
      logger.info('New database client connected');
      this.isConnected = true;
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Database pool error:', err);
      this.isConnected = false;
    });

    this.pool.on('remove', () => {
      logger.info('Database client removed from pool');
    });
  }

  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      logger.info('Database connection pool initialized successfully');
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database connection pool:', error);
      throw error;
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Database query executed', {
        query: text,
        duration: `${duration}ms`,
        rows: result.rowCount
      });
      
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query failed', {
        query: text,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const start = Date.now();
      const result = await this.pool.query('SELECT NOW() as current_time, version() as version');
      const duration = Date.now() - start;
      
      return {
        status: 'healthy',
        details: {
          connected: this.isConnected,
          responseTime: `${duration}ms`,
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingConnections: this.pool.waitingCount,
          serverTime: result.rows[0]?.current_time,
          version: result.rows[0]?.version?.split(' ')[0] // Extract just PostgreSQL version
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingConnections: this.pool.waitingCount
        }
      };
    }
  }

  get isHealthy(): boolean {
    return this.isConnected && this.pool.totalCount > 0;
  }

  get connectionPool(): Pool {
    return this.pool;
  }
}

// Create singleton instance
export const db = new DatabaseConnection();

// Export pool for direct access when needed
export const pool = db.connectionPool;