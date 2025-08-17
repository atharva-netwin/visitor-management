import request from 'supertest';
import { Pool } from 'pg';
import app from '../index';
import { pool } from '../database';
import { redis } from '../cache';

// Test database setup
let testPool: Pool;
let testUserId: string;
let authToken: string;

beforeAll(async () => {
  testPool = pool;
  
  // Clear Redis cache
  await redis.flushAll();
  
  // Create test user and get auth token
  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send({
      email: 'analytics@test.com',
      password: 'TestPassword123!',
      firstName: 'Analytics',
      lastName: 'User'
    });

  expect(registerResponse.status).toBe(201);
  testUserId = registerResponse.body.user.id;
  authToken = registerResponse.body.accessToken;

  // Create test visitors for analytics
  const testVisitors = [
    {
      name: 'John Doe',
      company: 'Tech Corp',
      interests: ['technology', 'innovation'],
      captureMethod: 'business_card',
      capturedAt: '2024-01-15T10:00:00Z'
    },
    {
      name: 'Jane Smith',
      company: 'Sales Inc',
      interests: ['sales', 'marketing'],
      captureMethod: 'event_badge',
      capturedAt: '2024-01-15T14:00:00Z'
    },
    {
      name: 'Bob Johnson',
      company: 'Tech Corp',
      interests: ['technology'],
      captureMethod: 'business_card',
      capturedAt: '2024-01-16T09:00:00Z'
    }
  ];

  for (const visitor of testVisitors) {
    await request(app)
      .post('/api/visitors')
      .set('Authorization', `Bearer ${authToken}`)
      .send(visitor);
  }
});

afterAll(async () => {
  // Clean up test data
  await testPool.query('DELETE FROM visitors WHERE user_id = $1', [testUserId]);
  await testPool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  await redis.flushAll();
});

describe('Analytics API Integration Tests', () => {
  describe('GET /api/analytics/daily/:date', () => {
    it('should return daily statistics for a specific date', async () => {
      const response = await request(app)
        .get('/api/analytics/daily/2024-01-15')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.date).toBe('2024-01-15');
      expect(response.body.data.totalVisitors).toBe(2);
      expect(response.body.data.byCompany).toEqual({
        'Tech Corp': 1,
        'Sales Inc': 1
      });
      expect(response.body.data.byCaptureMethod).toEqual({
        'business_card': 1,
        'event_badge': 1
      });
    });

    it('should return empty stats for date with no visitors', async () => {
      const response = await request(app)
        .get('/api/analytics/daily/2024-01-20')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalVisitors).toBe(0);
      expect(response.body.data.byCompany).toEqual({});
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/analytics/daily/invalid-date')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/daily/2024-01-15');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/analytics/monthly/:year/:month', () => {
    it('should return monthly statistics', async () => {
      const response = await request(app)
        .get('/api/analytics/monthly/2024/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.year).toBe(2024);
      expect(response.body.data.month).toBe(1);
      expect(response.body.data.totalVisitors).toBe(3);
      expect(response.body.data.dailyBreakdown).toHaveLength(2);
      expect(response.body.data.averagePerDay).toBeCloseTo(0.1); // 3 visitors / 31 days
    });

    it('should return 400 for invalid year/month', async () => {
      const response = await request(app)
        .get('/api/analytics/monthly/1999/13')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/analytics/report', () => {
    it('should return custom report with filters', async () => {
      const response = await request(app)
        .get('/api/analytics/report')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          groupBy: 'company'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalVisitors).toBe(3);
      expect(response.body.data.groupedData).toHaveLength(2);
      
      const techCorpGroup = response.body.data.groupedData.find((g: any) => g.group === 'Tech Corp');
      expect(techCorpGroup.count).toBe(2);
      expect(techCorpGroup.percentage).toBeCloseTo(66.67);
    });

    it('should filter by company', async () => {
      const response = await request(app)
        .get('/api/analytics/report')
        .query({
          company: 'Tech Corp'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.filteredVisitors).toBe(2);
    });

    it('should filter by capture method', async () => {
      const response = await request(app)
        .get('/api/analytics/report')
        .query({
          captureMethod: 'business_card'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.filteredVisitors).toBe(2);
    });

    it('should filter by interests', async () => {
      const response = await request(app)
        .get('/api/analytics/report')
        .query({
          interests: 'technology,innovation'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.filteredVisitors).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/analytics/report')
        .query({
          limit: 2,
          offset: 0
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.offset).toBe(0);
    });
  });

  describe('GET /api/analytics/export', () => {
    it('should export data as CSV', async () => {
      const response = await request(app)
        .get('/api/analytics/export')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('name,title,company');
      expect(response.text).toContain('John Doe');
    });

    it('should export data as JSON', async () => {
      const response = await request(app)
        .get('/api/analytics/export')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('attachment');
      
      const data = JSON.parse(response.text);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('company');
    });

    it('should return 400 for invalid format', async () => {
      const response = await request(app)
        .get('/api/analytics/export')
        .query({ format: 'xml' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should export filtered data', async () => {
      const response = await request(app)
        .get('/api/analytics/export')
        .query({
          format: 'json',
          company: 'Tech Corp'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const data = JSON.parse(response.text);
      expect(data.length).toBe(2);
      expect(data.every((visitor: any) => visitor.company === 'Tech Corp')).toBe(true);
    });
  });

  describe('Caching behavior', () => {
    it('should cache daily statistics', async () => {
      // Clear cache first
      await redis.flushAll();

      // First request should hit database
      const response1 = await request(app)
        .get('/api/analytics/daily/2024-01-15')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.status).toBe(200);

      // Second request should use cache (we can't easily test this without mocking, 
      // but we can verify the response is consistent)
      const response2 = await request(app)
        .get('/api/analytics/daily/2024-01-15')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.data).toEqual(response1.body.data);
    });
  });
});