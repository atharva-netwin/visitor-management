import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { AnalyticsService } from '../services/AnalyticsService';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../database';

const router = Router();

// Initialize analytics service and controller
const analyticsService = new AnalyticsService(pool);
const analyticsController = new AnalyticsController(analyticsService);

// Apply authentication middleware to all analytics routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/analytics/daily/{date}:
 *   get:
 *     summary: Get daily visitor statistics
 *     description: |
 *       Retrieves comprehensive visitor statistics for a specific date.
 *       Includes total counts, breakdowns by company, capture method, and interests.
 *       Results are cached for improved performance.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format
 *         example: "2023-01-01"
 *     responses:
 *       200:
 *         description: Daily statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                       example: "2023-01-01"
 *                     totalVisitors:
 *                       type: integer
 *                       example: 25
 *                     byCompany:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                       example:
 *                         "Tech Corp Inc.": 5
 *                         "Innovation Labs": 3
 *                         "Digital Solutions": 2
 *                     byCaptureMethod:
 *                       type: object
 *                       properties:
 *                         business_card:
 *                           type: integer
 *                           example: 18
 *                         event_badge:
 *                           type: integer
 *                           example: 7
 *                     byInterests:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                       example:
 *                         "technology": 15
 *                         "marketing": 8
 *                         "innovation": 12
 *                     topCompanies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           company:
 *                             type: string
 *                           count:
 *                             type: integer
 *                       example:
 *                         - company: "Tech Corp Inc."
 *                           count: 5
 *                         - company: "Innovation Labs"
 *                           count: 3
 *                     topInterests:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           interest:
 *                             type: string
 *                           count:
 *                             type: integer
 *                       example:
 *                         - interest: "technology"
 *                           count: 15
 *                         - interest: "innovation"
 *                           count: 12
 *                 error:
 *                   type: string
 *                   example: "No data found for the specified date"
 *       400:
 *         description: Invalid date format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/daily/:date', (req, res) => analyticsController.getDailyStats(req, res));

/**
 * @swagger
 * /api/analytics/monthly/{year}/{month}:
 *   get:
 *     summary: Get monthly visitor statistics
 *     description: |
 *       Retrieves comprehensive visitor statistics for a specific month.
 *       Includes daily breakdown, totals, averages, and trend analysis.
 *       Results are cached for improved performance.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *         description: Year (4-digit)
 *         example: 2023
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month (1-12)
 *         example: 1
 *     responses:
 *       200:
 *         description: Monthly statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     year:
 *                       type: integer
 *                       example: 2023
 *                     month:
 *                       type: integer
 *                       example: 1
 *                     totalVisitors:
 *                       type: integer
 *                       example: 450
 *                     dailyBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           count:
 *                             type: integer
 *                       example:
 *                         - date: "2023-01-01"
 *                           count: 25
 *                         - date: "2023-01-02"
 *                           count: 18
 *                     byCompany:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                     byCaptureMethod:
 *                       type: object
 *                       properties:
 *                         business_card:
 *                           type: integer
 *                         event_badge:
 *                           type: integer
 *                     byInterests:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                     topCompanies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           company:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     topInterests:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           interest:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     averagePerDay:
 *                       type: number
 *                       format: float
 *                       example: 14.5
 *                 error:
 *                   type: string
 *       400:
 *         description: Invalid year or month
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/monthly/:year/:month', (req, res) => analyticsController.getMonthlyStats(req, res));

/**
 * @swagger
 * /api/analytics/report:
 *   get:
 *     summary: Generate custom analytics report
 *     description: |
 *       Generates a custom analytics report with flexible filtering and grouping options.
 *       Supports date ranges, company filters, interest filters, and various grouping strategies.
 *       Results include summary statistics and detailed breakdowns.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for the report (ISO format)
 *         example: "2023-01-01T00:00:00.000Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for the report (ISO format)
 *         example: "2023-01-31T23:59:59.999Z"
 *       - in: query
 *         name: company
 *         schema:
 *           type: string
 *         description: Filter by company name (partial match)
 *         example: "Tech Corp"
 *       - in: query
 *         name: captureMethod
 *         schema:
 *           type: string
 *           enum: [business_card, event_badge]
 *         description: Filter by capture method
 *       - in: query
 *         name: interests
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: form
 *         explode: true
 *         description: Filter by interests (multiple values supported)
 *         example: ["technology", "marketing"]
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month, company, interest]
 *         description: Group results by specified dimension
 *         example: "day"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Maximum number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalVisitors:
 *                       type: integer
 *                       example: 150
 *                     filteredVisitors:
 *                       type: integer
 *                       example: 75
 *                     groupedData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           group:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           percentage:
 *                             type: number
 *                       example:
 *                         - group: "2023-01-01"
 *                           count: 25
 *                           percentage: 33.3
 *                         - group: "2023-01-02"
 *                           count: 18
 *                           percentage: 24.0
 *                     summary:
 *                       type: object
 *                       properties:
 *                         byCompany:
 *                           type: object
 *                           additionalProperties:
 *                             type: integer
 *                         byCaptureMethod:
 *                           type: object
 *                         byInterests:
 *                           type: object
 *                           additionalProperties:
 *                             type: integer
 *                         dateRange:
 *                           type: object
 *                           properties:
 *                             start:
 *                               type: string
 *                               format: date-time
 *                             end:
 *                               type: string
 *                               format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                 error:
 *                   type: string
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/report', (req, res) => analyticsController.getReport(req, res));

/**
 * @swagger
 * /api/analytics/export:
 *   get:
 *     summary: Export visitor data
 *     description: |
 *       Exports visitor data in CSV or JSON format with optional filtering.
 *       Supports the same filtering options as the report endpoint.
 *       Large exports are streamed for better performance.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *         description: Export format
 *         example: "csv"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for export (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for export (ISO format)
 *       - in: query
 *         name: company
 *         schema:
 *           type: string
 *         description: Filter by company name (partial match)
 *       - in: query
 *         name: captureMethod
 *         schema:
 *           type: string
 *           enum: [business_card, event_badge]
 *         description: Filter by capture method
 *       - in: query
 *         name: interests
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: form
 *         explode: true
 *         description: Filter by interests (multiple values supported)
 *     responses:
 *       200:
 *         description: Data exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: |
 *                 Name,Company,Email,Phone,Interests,Capture Method,Captured At
 *                 Jane Smith,Tech Corp Inc.,jane@techcorp.com,+1234567890,"technology,marketing",business_card,2023-01-01T10:30:00.000Z
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: string
 *                   description: JSON string of exported data
 *                 filename:
 *                   type: string
 *                   example: "visitors_export_2023-01-01.csv"
 *                 contentType:
 *                   type: string
 *                   example: "text/csv"
 *       400:
 *         description: Invalid export parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/export', (req, res) => analyticsController.exportData(req, res));

export { router as analyticsRouter };