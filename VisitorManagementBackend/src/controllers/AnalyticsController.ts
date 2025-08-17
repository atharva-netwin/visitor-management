import { Request, Response } from 'express';
import { AnalyticsService, ReportFilters } from '../services/AnalyticsService';
import { logger } from '../utils/logger';
import { ErrorCodes } from '../types';

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  async getDailyStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { date } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId: req.correlationId
          }
        });
        return;
      }

      if (!date) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Date parameter is required',
            correlationId: req.correlationId
          }
        });
        return;
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Invalid date format. Use YYYY-MM-DD',
            correlationId: req.correlationId
          }
        });
        return;
      }

      const result = await this.analyticsService.getDailyStats(userId, date);
      
      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: result.error || 'Failed to retrieve daily statistics',
            correlationId: req.correlationId
          }
        });
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Error in getDailyStats controller', { error, userId: req.user?.id, date: req.params['date'] });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId: req.correlationId
        }
      });
    }
  }

  async getMonthlyStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { year, month } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId: req.correlationId
          }
        });
        return;
      }

      if (!year || !month) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Year and month parameters are required',
            correlationId: req.correlationId
          }
        });
        return;
      }

      // Validate year and month
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      
      if (isNaN(yearNum) || isNaN(monthNum) || yearNum < 2000 || yearNum > 3000 || monthNum < 1 || monthNum > 12) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Invalid year or month. Year must be between 2000-3000, month must be 1-12',
            correlationId: req.correlationId
          }
        });
        return;
      }

      const result = await this.analyticsService.getMonthlyStats(userId, yearNum, monthNum);
      
      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: result.error || 'Failed to retrieve monthly statistics',
            correlationId: req.correlationId
          }
        });
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Error in getMonthlyStats controller', { error, userId: req.user?.id, params: req.params });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId: req.correlationId
        }
      });
    }
  }

  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId: req.correlationId
          }
        });
        return;
      }

      // Parse query parameters for filters
      const filters: ReportFilters = {};
      
      if (req.query['startDate']) {
        filters.startDate = req.query['startDate'] as string;
      }
      
      if (req.query['endDate']) {
        filters.endDate = req.query['endDate'] as string;
      }
      
      if (req.query['company']) {
        filters.company = req.query['company'] as string;
      }
      
      if (req.query['captureMethod']) {
        const method = req.query['captureMethod'] as string;
        if (method === 'business_card' || method === 'event_badge') {
          filters.captureMethod = method;
        }
      }
      
      if (req.query['interests']) {
        const interests = req.query['interests'] as string;
        filters.interests = interests.split(',').map(i => i.trim());
      }
      
      if (req.query['groupBy']) {
        const groupBy = req.query['groupBy'] as string;
        if (['day', 'week', 'month', 'company', 'interest'].includes(groupBy)) {
          filters.groupBy = groupBy as any;
        }
      }
      
      if (req.query['limit']) {
        const limit = parseInt(req.query['limit'] as string);
        if (!isNaN(limit) && limit > 0 && limit <= 1000) {
          filters.limit = limit;
        }
      }
      
      if (req.query['offset']) {
        const offset = parseInt(req.query['offset'] as string);
        if (!isNaN(offset) && offset >= 0) {
          filters.offset = offset;
        }
      }

      const result = await this.analyticsService.getReport(userId, filters);
      
      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: result.error || 'Failed to generate report',
            correlationId: req.correlationId
          }
        });
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Error in getReport controller', { error, userId: req.user?.id, query: req.query });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId: req.correlationId
        }
      });
    }
  }

  async exportData(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const format = req.query['format'] as string;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId: req.correlationId
          }
        });
        return;
      }

      // Validate format
      if (!format || (format !== 'csv' && format !== 'json')) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Invalid format. Must be "csv" or "json"',
            correlationId: req.correlationId
          }
        });
        return;
      }

      // Parse filters (same as getReport)
      const filters: ReportFilters = {};
      
      if (req.query['startDate']) {
        filters.startDate = req.query['startDate'] as string;
      }
      
      if (req.query['endDate']) {
        filters.endDate = req.query['endDate'] as string;
      }
      
      if (req.query['company']) {
        filters.company = req.query['company'] as string;
      }
      
      if (req.query['captureMethod']) {
        const method = req.query['captureMethod'] as string;
        if (method === 'business_card' || method === 'event_badge') {
          filters.captureMethod = method;
        }
      }
      
      if (req.query['interests']) {
        const interests = req.query['interests'] as string;
        filters.interests = interests.split(',').map(i => i.trim());
      }

      const result = await this.analyticsService.exportData(userId, format as 'csv' | 'json', filters);
      
      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: result.error || 'Failed to export data',
            correlationId: req.correlationId
          }
        });
        return;
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error) {
      logger.error('Error in exportData controller', { error, userId: req.user?.id, query: req.query });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId: req.correlationId
        }
      });
    }
  }
}