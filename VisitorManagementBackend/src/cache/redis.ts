import { createClient, RedisClientOptions } from 'redis';
import { config } from '../config/config';
import { logger } from '../utils/logger';

class RedisConnection {
  private client: any; // Using any to avoid complex Redis type issues
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  // private reconnectDelay: number = 1000; // Start with 1 second

  constructor() {
    const redisOptions: RedisClientOptions = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 5000,
      },
      ...(config.redis.password && { password: config.redis.password }),
    };

    this.client = createClient(redisOptions);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      logger.info('Redis client connected and ready');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      // this.reconnectDelay = 1000; // Reset delay
    });

    this.client.on('error', (error: Error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis client connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.reconnectAttempts++;
      logger.info(`Redis client reconnecting... (attempt ${this.reconnectAttempts})`);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error('Max Redis reconnection attempts reached');
        this.client.disconnect();
      }
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
        
        // Test the connection
        await this.client.ping();
        
        this.isConnected = true;
        logger.info('Redis connection established successfully');
      }
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
        this.isConnected = false;
        logger.info('Redis connection closed');
      }
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
      throw error;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      
      logger.debug(`Redis SET: ${key}`, { ttl: ttlSeconds });
    } catch (error) {
      logger.error(`Redis SET failed for key ${key}:`, error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      logger.debug(`Redis GET: ${key}`, { found: !!value });
      return value;
    } catch (error) {
      logger.error(`Redis GET failed for key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      const result = await this.client.del(key);
      logger.debug(`Redis DEL: ${key}`, { deleted: result });
      return result;
    } catch (error) {
      logger.error(`Redis DEL failed for key ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS failed for key ${key}:`, error);
      throw error;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result;
    } catch (error) {
      logger.error(`Redis EXPIRE failed for key ${key}:`, error);
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL failed for key ${key}:`, error);
      throw error;
    }
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    try {
      const result = await this.client.hSet(key, field, value);
      logger.debug(`Redis HSET: ${key}.${field}`);
      return result;
    } catch (error) {
      logger.error(`Redis HSET failed for key ${key}.${field}:`, error);
      throw error;
    }
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    try {
      const value = await this.client.hGet(key, field);
      logger.debug(`Redis HGET: ${key}.${field}`, { found: !!value });
      return value;
    } catch (error) {
      logger.error(`Redis HGET failed for key ${key}.${field}:`, error);
      throw error;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      const result = await this.client.hGetAll(key);
      logger.debug(`Redis HGETALL: ${key}`, { fields: Object.keys(result).length });
      return result;
    } catch (error) {
      logger.error(`Redis HGETALL failed for key ${key}:`, error);
      throw error;
    }
  }

  async hDel(key: string, field: string): Promise<number> {
    try {
      const result = await this.client.hDel(key, field);
      logger.debug(`Redis HDEL: ${key}.${field}`, { deleted: result });
      return result;
    } catch (error) {
      logger.error(`Redis HDEL failed for key ${key}.${field}:`, error);
      throw error;
    }
  }

  async flushAll(): Promise<void> {
    try {
      await this.client.flushAll();
      logger.info('Redis cache cleared (FLUSHALL)');
    } catch (error) {
      logger.error('Redis FLUSHALL failed:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const start = Date.now();
      const pong = await this.client.ping();
      const duration = Date.now() - start;
      
      const info = await this.client.info('server');
      const serverInfo = this.parseRedisInfo(info);
      
      return {
        status: 'healthy',
        details: {
          connected: this.isConnected,
          responseTime: `${duration}ms`,
          ping: pong,
          version: serverInfo['redis_version'],
          uptime: serverInfo['uptime_in_seconds'],
          connectedClients: serverInfo['connected_clients'],
          usedMemory: serverInfo['used_memory_human'],
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          reconnectAttempts: this.reconnectAttempts
        }
      };
    }
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  get isHealthy(): boolean {
    return this.isConnected;
  }

  get nativeClient(): any {
    return this.client;
  }
}

// Create singleton instance
export const redis = new RedisConnection();