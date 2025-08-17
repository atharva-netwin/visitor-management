import { AnalyticsService } from '../services/AnalyticsService';
import { redis } from '../cache';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('../cache', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn()
  }
}));

jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockPool: any;
  let mockRedis: jest.Mocked<typeof redis>;

  beforeEach(() => {
    mockPool = {
      query: jest.fn()
    };

    mockRedis = redis as jest.Mocked<typeof redis>;
    analyticsService = new AnalyticsService(mockPool);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getDailyStats', () => {
    const userId = 'user-123';
    const date = '2024-01-15';

    it('should return cached data if available', async () => {
      const cachedData = {
        date,
        totalVisitors: 5,
        byCompany: { 'Company A': 3, 'Company B': 2 },
        byCaptureMethod: { 'business_card': 3, 'event_badge': 2 },
        byInterests: { 'tech': 4, 'sales': 1 },
        topCompanies: [{ company: 'Company A', count: 3 }],
        topInterests: [{ interest: 'tech', count: 4 }]
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await analyticsService.getDailyStats(userId, date);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should query database and cache results when no cache exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const mockRows = [
        {
          total_visitors: '3',
          company: 'Company A',
          capture_method: 'business_card',
          interests: ['tech', 'sales']
        },
        {
          total_visitors: '2',
          company: 'Company B',
          capture_method: 'event_badge',
          interests: ['tech']
        }
      ];

      mockPool.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await analyticsService.getDailyStats(userId, date);

      expect(result.success).toBe(true);
      expect(result.data?.totalVisitors).toBe(5);
      expect(result.data?.byCompany).toEqual({ 'Company A': 3, 'Company B': 2 });
      expect(result.data?.byCaptureMethod).toEqual({ 'business_card': 3, 'event_badge': 2 });
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should return empty stats when no data found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await analyticsService.getDailyStats(userId, date);

      expect(result.success).toBe(true);
      expect(result.data?.totalVisitors).toBe(0);
      expect(result.data?.byCompany).toEqual({});
    });

    it('should handle database errors gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const result = await analyticsService.getDailyStats(userId, date);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to retrieve daily statistics');
    });
  });

  describe('getMonthlyStats', () => {
    const userId = 'user-123';
    const year = 2024;
    const month = 1;

    it('should return cached data if available', async () => {
      const cachedData = {
        year,
        month,
        totalVisitors: 10,
        dailyBreakdown: [{ date: '2024-01-01', count: 5 }],
        byCompany: { 'Company A': 6, 'Company B': 4 },
        byCaptureMethod: { 'business_card': 7, 'event_badge': 3 },
        byInterests: { 'tech': 8, 'sales': 2 },
        topCompanies: [{ company: 'Company A', count: 6 }],
        topInterests: [{ interest: 'tech', count: 8 }],
        averagePerDay: 0.32
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await analyticsService.getMonthlyStats(userId, year, month);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should query database and process monthly stats', async () => {
      mockRedis.get.mockResolvedValue(null);

      const mockRows = [
        {
          capture_date: '2024-01-01',
          daily_count: '3',
          company: 'Company A',
          capture_method: 'business_card',
          interests: ['tech']
        },
        {
          capture_date: '2024-01-02',
          daily_count: '2',
          company: 'Company B',
          capture_method: 'event_badge',
          interests: ['sales']
        }
      ];

      mockPool.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await analyticsService.getMonthlyStats(userId, year, month);

      expect(result.success).toBe(true);
      expect(result.data?.totalVisitors).toBe(5);
      expect(result.data?.dailyBreakdown).toHaveLength(2);
      expect(result.data?.averagePerDay).toBeCloseTo(0.16); // 5 visitors / 31 days
    });

    it('should return empty stats when no data found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await analyticsService.getMonthlyStats(userId, year, month);

      expect(result.success).toBe(true);
      expect(result.data?.totalVisitors).toBe(0);
      expect(result.data?.dailyBreakdown).toEqual([]);
    });
  });

  describe('getReport', () => {
    const userId = 'user-123';

    it('should generate report with filters', async () => {
      mockRedis.get.mockResolvedValue(null);

      const mockRows = [
        {
          id: '1',
          name: 'John Doe',
          company: 'Company A',
          capture_method: 'business_card',
          interests: ['tech'],
          captured_at: '2024-01-01T10:00:00Z',
          capture_date: '2024-01-01'
        },
        {
          id: '2',
          name: 'Jane Smith',
          company: 'Company B',
          capture_method: 'event_badge',
          interests: ['sales'],
          captured_at: '2024-01-02T10:00:00Z',
          capture_date: '2024-01-02'
        }
      ];

      mockPool.query.mockResolvedValue({ rows: mockRows } as any);

      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: 'company' as const
      };

      const result = await analyticsService.getReport(userId, filters);

      expect(result.success).toBe(true);
      expect(result.data?.totalVisitors).toBe(2);
      expect(result.data?.groupedData).toHaveLength(2);
      expect(result.data?.summary.byCompany).toEqual({ 'Company A': 1, 'Company B': 1 });
    });

    it('should handle empty results', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await analyticsService.getReport(userId, {});

      expect(result.success).toBe(true);
      expect(result.data?.totalVisitors).toBe(0);
      expect(result.data?.groupedData).toEqual([]);
    });
  });

  describe('exportData', () => {
    const userId = 'user-123';

    it('should export data as CSV', async () => {
      const mockRows = [
        {
          name: 'John Doe',
          company: 'Company A',
          phone: '123-456-7890',
          email: 'john@example.com',
          interests: 'tech, sales',
          capture_method: 'business_card',
          captured_at: '2024-01-01T10:00:00Z'
        }
      ];

      mockPool.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await analyticsService.exportData(userId, 'csv', {});

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('text/csv');
      expect(result.data).toContain('name,company,phone');
      expect(result.data).toContain('John Doe,Company A,123-456-7890');
    });

    it('should export data as JSON', async () => {
      const mockRows = [
        {
          name: 'John Doe',
          company: 'Company A',
          interests: 'tech'
        }
      ];

      mockPool.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await analyticsService.exportData(userId, 'json', {});

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('application/json');
      expect(result.data).toContain('"name": "John Doe"');
    });

    it('should handle empty data export', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await analyticsService.exportData(userId, 'csv', {});

      expect(result.success).toBe(true);
      expect(result.data).toBe('No data available');
    });
  });
});