import { Pool } from 'pg';
import { redis } from '../cache';
import { logger } from '../utils/logger';

export interface DailyStatsResponse {
  success: boolean;
  data?: {
    date: string;
    totalVisitors: number;
    byCompany: Record<string, number>;
    byCaptureMethod: Record<string, number>;
    byInterests: Record<string, number>;
    topCompanies: Array<{ company: string; count: number }>;
    topInterests: Array<{ interest: string; count: number }>;
  };
  error?: string;
}

export interface MonthlyStatsResponse {
  success: boolean;
  data?: {
    year: number;
    month: number;
    totalVisitors: number;
    dailyBreakdown: Array<{ date: string; count: number }>;
    byCompany: Record<string, number>;
    byCaptureMethod: Record<string, number>;
    byInterests: Record<string, number>;
    topCompanies: Array<{ company: string; count: number }>;
    topInterests: Array<{ interest: string; count: number }>;
    averagePerDay: number;
  };
  error?: string;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  company?: string;
  captureMethod?: 'business_card' | 'event_badge';
  interests?: string[];
  groupBy?: 'day' | 'week' | 'month' | 'company' | 'interest';
  limit?: number;
  offset?: number;
}

export interface ReportResponse {
  success: boolean;
  data?: {
    totalVisitors: number;
    filteredVisitors: number;
    groupedData: Array<{
      group: string;
      count: number;
      percentage: number;
    }>;
    summary: {
      byCompany: Record<string, number>;
      byCaptureMethod: Record<string, number>;
      byInterests: Record<string, number>;
      dateRange: {
        start: string;
        end: string;
      };
    };
    pagination?: {
      limit: number;
      offset: number;
      total: number;
    };
  };
  error?: string;
}

export interface ExportResponse {
  success: boolean;
  data?: string; // CSV content or JSON string
  filename?: string;
  contentType?: string;
  error?: string;
}

export class AnalyticsService {
  private pool: Pool;
  private cacheConfig = {
    dailyStats: { ttl: 3600 }, // 1 hour
    monthlyStats: { ttl: 86400 }, // 24 hours
    reports: { ttl: 1800 } // 30 minutes
  };

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getDailyStats(userId: string, date: string): Promise<DailyStatsResponse> {
    try {
      const cacheKey = `analytics:daily:${userId}:${date}`;
      
      // Try to get from cache first
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached
        };
      }

      // Query database for daily stats
      const query = `
        SELECT 
          COUNT(*) as total_visitors,
          company,
          capture_method,
          interests
        FROM visitors 
        WHERE user_id = $1 
          AND DATE(captured_at AT TIME ZONE 'UTC') = $2
          AND deleted_at IS NULL
        GROUP BY company, capture_method, interests
      `;

      const result = await this.pool.query(query, [userId, date]);
      
      if (result.rows.length === 0) {
        return {
          success: true,
          data: {
            date,
            totalVisitors: 0,
            byCompany: {},
            byCaptureMethod: {},
            byInterests: {},
            topCompanies: [],
            topInterests: []
          }
        };
      }

      // Process the results
      const stats = this.processDailyStats(result.rows, date);
      
      // Cache the results
      await this.setCachedData(cacheKey, stats, this.cacheConfig.dailyStats.ttl);
      
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      logger.error('Error in getDailyStats', { error, userId, date });
      return {
        success: false,
        error: 'Failed to retrieve daily statistics'
      };
    }
  }

  async getMonthlyStats(userId: string, year: number, month: number): Promise<MonthlyStatsResponse> {
    try {
      const cacheKey = `analytics:monthly:${userId}:${year}:${month}`;
      
      // Try to get from cache first
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached
        };
      }

      // Query database for monthly stats
      const query = `
        SELECT 
          DATE(captured_at AT TIME ZONE 'UTC') as capture_date,
          COUNT(*) as daily_count,
          company,
          capture_method,
          interests
        FROM visitors 
        WHERE user_id = $1 
          AND EXTRACT(YEAR FROM captured_at AT TIME ZONE 'UTC') = $2
          AND EXTRACT(MONTH FROM captured_at AT TIME ZONE 'UTC') = $3
          AND deleted_at IS NULL
        GROUP BY capture_date, company, capture_method, interests
        ORDER BY capture_date
      `;

      const result = await this.pool.query(query, [userId, year, month]);
      
      if (result.rows.length === 0) {
        return {
          success: true,
          data: {
            year,
            month,
            totalVisitors: 0,
            dailyBreakdown: [],
            byCompany: {},
            byCaptureMethod: {},
            byInterests: {},
            topCompanies: [],
            topInterests: [],
            averagePerDay: 0
          }
        };
      }

      // Process the results
      const stats = this.processMonthlyStats(result.rows, year, month);
      
      // Cache the results
      await this.setCachedData(cacheKey, stats, this.cacheConfig.monthlyStats.ttl);
      
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      logger.error('Error in getMonthlyStats', { error, userId, year, month });
      return {
        success: false,
        error: 'Failed to retrieve monthly statistics'
      };
    }
  }

  private processDailyStats(rows: any[], date: string) {
    const byCompany: Record<string, number> = {};
    const byCaptureMethod: Record<string, number> = {};
    const byInterests: Record<string, number> = {};
    let totalVisitors = 0;

    rows.forEach(row => {
      const count = parseInt(row.total_visitors);
      totalVisitors += count;

      // Group by company
      byCompany[row.company] = (byCompany[row.company] || 0) + count;

      // Group by capture method
      byCaptureMethod[row.capture_method] = (byCaptureMethod[row.capture_method] || 0) + count;

      // Group by interests (interests is a JSON array)
      if (row.interests && Array.isArray(row.interests)) {
        row.interests.forEach((interest: string) => {
          byInterests[interest] = (byInterests[interest] || 0) + count;
        });
      }
    });

    // Get top companies and interests
    const topCompanies = Object.entries(byCompany)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topInterests = Object.entries(byInterests)
      .map(([interest, count]) => ({ interest, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      date,
      totalVisitors,
      byCompany,
      byCaptureMethod,
      byInterests,
      topCompanies,
      topInterests
    };
  }

  private processMonthlyStats(rows: any[], year: number, month: number) {
    const dailyBreakdown: Array<{ date: string; count: number }> = [];
    const byCompany: Record<string, number> = {};
    const byCaptureMethod: Record<string, number> = {};
    const byInterests: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};
    let totalVisitors = 0;

    rows.forEach(row => {
      const count = parseInt(row.daily_count);
      const date = row.capture_date;
      
      totalVisitors += count;
      dailyCounts[date] = (dailyCounts[date] || 0) + count;

      // Group by company
      byCompany[row.company] = (byCompany[row.company] || 0) + count;

      // Group by capture method
      byCaptureMethod[row.capture_method] = (byCaptureMethod[row.capture_method] || 0) + count;

      // Group by interests
      if (row.interests && Array.isArray(row.interests)) {
        row.interests.forEach((interest: string) => {
          byInterests[interest] = (byInterests[interest] || 0) + count;
        });
      }
    });

    // Create daily breakdown
    Object.entries(dailyCounts).forEach(([date, count]) => {
      dailyBreakdown.push({ date, count });
    });
    dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));

    // Get top companies and interests
    const topCompanies = Object.entries(byCompany)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topInterests = Object.entries(byInterests)
      .map(([interest, count]) => ({ interest, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate average per day
    const daysInMonth = new Date(year, month, 0).getDate();
    const averagePerDay = totalVisitors / daysInMonth;

    return {
      year,
      month,
      totalVisitors,
      dailyBreakdown,
      byCompany,
      byCaptureMethod,
      byInterests,
      topCompanies,
      topInterests,
      averagePerDay: Math.round(averagePerDay * 100) / 100
    };
  }

  private async getCachedData(key: string): Promise<any | null> {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.warn('Cache get failed', { error, key });
      return null;
    }
  }

  async getReport(userId: string, filters: ReportFilters = {}): Promise<ReportResponse> {
    try {
      const cacheKey = `analytics:report:${userId}:${JSON.stringify(filters)}`;
      
      // Try to get from cache first
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached
        };
      }

      // Build dynamic query based on filters
      const { query, params } = this.buildReportQuery(userId, filters);
      
      const result = await this.pool.query(query, params);
      
      if (result.rows.length === 0) {
        return {
          success: true,
          data: {
            totalVisitors: 0,
            filteredVisitors: 0,
            groupedData: [],
            summary: {
              byCompany: {},
              byCaptureMethod: {},
              byInterests: {},
              dateRange: {
                start: filters.startDate || '',
                end: filters.endDate || ''
              }
            }
          }
        };
      }

      // Process the results
      const reportData = this.processReportData(result.rows, filters);
      
      // Cache the results
      await this.setCachedData(cacheKey, reportData, this.cacheConfig.reports.ttl);
      
      return {
        success: true,
        data: reportData
      };
    } catch (error) {
      logger.error('Error in getReport', { error, userId, filters });
      return {
        success: false,
        error: 'Failed to generate report'
      };
    }
  }

  private async setCachedData(key: string, data: any, ttl: number): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(data), ttl);
    } catch (error) {
      logger.warn('Cache set failed', { error, key });
      // Don't throw error, just log warning
    }
  }

  async exportData(userId: string, format: 'csv' | 'json', filters: ReportFilters = {}): Promise<ExportResponse> {
    try {
      // Get the raw data for export
      const { query, params } = this.buildExportQuery(userId, filters);
      const result = await this.pool.query(query, params);
      
      if (result.rows.length === 0) {
        return {
          success: true,
          data: format === 'csv' ? 'No data available' : '[]',
          filename: `visitors_export_${new Date().toISOString().split('T')[0]}.${format}`,
          contentType: format === 'csv' ? 'text/csv' : 'application/json'
        };
      }

      let exportData: string;
      let contentType: string;
      
      if (format === 'csv') {
        exportData = this.convertToCSV(result.rows);
        contentType = 'text/csv';
      } else {
        exportData = JSON.stringify(result.rows, null, 2);
        contentType = 'application/json';
      }

      const filename = `visitors_export_${new Date().toISOString().split('T')[0]}.${format}`;
      
      return {
        success: true,
        data: exportData,
        filename,
        contentType
      };
    } catch (error) {
      logger.error('Error in exportData', { error, userId, format, filters });
      return {
        success: false,
        error: 'Failed to export data'
      };
    }
  }

  private buildReportQuery(userId: string, filters: ReportFilters) {
    let query = `
      SELECT 
        v.id,
        v.name,
        v.title,
        v.company,
        v.phone,
        v.email,
        v.website,
        v.interests,
        v.notes,
        v.capture_method,
        v.captured_at,
        v.created_at,
        DATE(v.captured_at AT TIME ZONE 'UTC') as capture_date
      FROM visitors v
      WHERE v.user_id = $1 AND v.deleted_at IS NULL
    `;
    
    const params: any[] = [userId];
    let paramIndex = 2;

    // Add date filters
    if (filters.startDate) {
      query += ` AND v.captured_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    
    if (filters.endDate) {
      query += ` AND v.captured_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    // Add company filter
    if (filters.company) {
      query += ` AND LOWER(v.company) LIKE LOWER($${paramIndex})`;
      params.push(`%${filters.company}%`);
      paramIndex++;
    }

    // Add capture method filter
    if (filters.captureMethod) {
      query += ` AND v.capture_method = $${paramIndex}`;
      params.push(filters.captureMethod);
      paramIndex++;
    }

    // Add interests filter
    if (filters.interests && filters.interests.length > 0) {
      query += ` AND v.interests && $${paramIndex}`;
      params.push(JSON.stringify(filters.interests));
      paramIndex++;
    }

    // Add ordering
    query += ` ORDER BY v.captured_at DESC`;

    // Add pagination
    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }
    
    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    return { query, params };
  }

  private buildExportQuery(userId: string, filters: ReportFilters) {
    let query = `
      SELECT 
        v.name,
        v.title,
        v.company,
        v.phone,
        v.email,
        v.website,
        array_to_string(v.interests, ', ') as interests,
        v.notes,
        v.capture_method,
        v.captured_at,
        v.created_at
      FROM visitors v
      WHERE v.user_id = $1 AND v.deleted_at IS NULL
    `;
    
    const params: any[] = [userId];
    let paramIndex = 2;

    // Add same filters as report query
    if (filters.startDate) {
      query += ` AND v.captured_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    
    if (filters.endDate) {
      query += ` AND v.captured_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.company) {
      query += ` AND LOWER(v.company) LIKE LOWER($${paramIndex})`;
      params.push(`%${filters.company}%`);
      paramIndex++;
    }

    if (filters.captureMethod) {
      query += ` AND v.capture_method = $${paramIndex}`;
      params.push(filters.captureMethod);
      paramIndex++;
    }

    if (filters.interests && filters.interests.length > 0) {
      query += ` AND v.interests && $${paramIndex}`;
      params.push(JSON.stringify(filters.interests));
      paramIndex++;
    }

    query += ` ORDER BY v.captured_at DESC`;

    return { query, params };
  }

  private processReportData(rows: any[], filters: ReportFilters) {
    const totalVisitors = rows.length;
    const byCompany: Record<string, number> = {};
    const byCaptureMethod: Record<string, number> = {};
    const byInterests: Record<string, number> = {};
    
    // Process each row
    rows.forEach(row => {
      // Group by company
      byCompany[row.company] = (byCompany[row.company] || 0) + 1;

      // Group by capture method
      byCaptureMethod[row.capture_method] = (byCaptureMethod[row.capture_method] || 0) + 1;

      // Group by interests
      if (row.interests && Array.isArray(row.interests)) {
        row.interests.forEach((interest: string) => {
          byInterests[interest] = (byInterests[interest] || 0) + 1;
        });
      }
    });

    // Create grouped data based on groupBy parameter
    let groupedData: Array<{ group: string; count: number; percentage: number }> = [];
    
    switch (filters.groupBy) {
      case 'company':
        groupedData = Object.entries(byCompany).map(([group, count]) => ({
          group,
          count,
          percentage: Math.round((count / totalVisitors) * 100 * 100) / 100
        }));
        break;
      case 'interest':
        groupedData = Object.entries(byInterests).map(([group, count]) => ({
          group,
          count,
          percentage: Math.round((count / totalVisitors) * 100 * 100) / 100
        }));
        break;
      case 'day':
        const dailyGroups: Record<string, number> = {};
        rows.forEach(row => {
          const date = row.capture_date;
          dailyGroups[date] = (dailyGroups[date] || 0) + 1;
        });
        groupedData = Object.entries(dailyGroups).map(([group, count]) => ({
          group,
          count,
          percentage: Math.round((count / totalVisitors) * 100 * 100) / 100
        }));
        break;
      default:
        // Default to company grouping
        groupedData = Object.entries(byCompany).map(([group, count]) => ({
          group,
          count,
          percentage: Math.round((count / totalVisitors) * 100 * 100) / 100
        }));
    }

    // Sort grouped data by count descending
    groupedData.sort((a, b) => b.count - a.count);

    // Determine date range
    const dates = rows.map(row => row.captured_at).sort();
    const dateRange = {
      start: dates[0] || filters.startDate || '',
      end: dates[dates.length - 1] || filters.endDate || ''
    };

    return {
      totalVisitors,
      filteredVisitors: totalVisitors,
      groupedData,
      summary: {
        byCompany,
        byCaptureMethod,
        byInterests,
        dateRange
      },
      ...(filters.limit && {
        pagination: {
          limit: filters.limit,
          offset: filters.offset || 0,
          total: totalVisitors
        }
      })
    };
  }

  private convertToCSV(rows: any[]): string {
    if (rows.length === 0) {
      return 'No data available';
    }

    // Get headers from first row
    const headers = Object.keys(rows[0]);
    
    // Create CSV content
    const csvRows = [
      headers.join(','), // Header row
      ...rows.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle null/undefined values and escape commas/quotes
          if (value === null || value === undefined) {
            return '';
          }
          const stringValue = String(value);
          // Escape quotes and wrap in quotes if contains comma or quote
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }
}