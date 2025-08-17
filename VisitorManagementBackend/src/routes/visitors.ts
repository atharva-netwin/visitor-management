import { Router } from 'express';
import { VisitorController } from '../controllers/VisitorController';
import { VisitorService } from '../services/VisitorService';
import { authenticateToken } from '../middleware/auth';
import { validateRequest, createVisitorSchema, updateVisitorSchema, bulkSyncSchema } from '../utils/validation';
import { pool } from '../database';

const router = Router();

// Initialize service and controller
const visitorService = new VisitorService(pool);
const visitorController = new VisitorController(visitorService);

// All visitor routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/visitors:
 *   post:
 *     summary: Create a new visitor
 *     description: |
 *       Creates a new visitor record for the authenticated user.
 *       All visitor data is validated and stored with user association.
 *       Supports local ID mapping for mobile app synchronization.
 *     tags: [Visitors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateVisitorRequest'
 *           examples:
 *             business_card:
 *               summary: Business card capture
 *               value:
 *                 name: "Jane Smith"
 *                 title: "Marketing Director"
 *                 company: "Tech Corp Inc."
 *                 phone: "+1234567890"
 *                 email: "jane.smith@techcorp.com"
 *                 website: "https://www.techcorp.com"
 *                 interests: ["technology", "marketing", "innovation"]
 *                 notes: "Met at tech conference, interested in our new product line"
 *                 captureMethod: "business_card"
 *                 capturedAt: "2023-01-01T10:30:00.000Z"
 *                 localId: "local_123456"
 *             event_badge:
 *               summary: Event badge capture
 *               value:
 *                 name: "John Doe"
 *                 company: "Innovation Labs"
 *                 interests: ["AI", "machine learning"]
 *                 captureMethod: "event_badge"
 *                 capturedAt: "2023-01-01T14:15:00.000Z"
 *     responses:
 *       201:
 *         description: Visitor created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorResponse'
 *       400:
 *         description: Validation error
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
router.post(
  '/',
  validateRequest(createVisitorSchema),
  visitorController.createVisitor
);

/**
 * @swagger
 * /api/visitors:
 *   get:
 *     summary: Get all visitors for authenticated user
 *     description: |
 *       Retrieves all visitors associated with the authenticated user.
 *       Supports pagination, filtering, and search functionality.
 *       Results are ordered by capture date (most recent first).
 *     tags: [Visitors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of visitors per page
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
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter visitors captured after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter visitors captured before this date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, company, email, and notes
 *     responses:
 *       200:
 *         description: Visitors retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorListResponse'
 *             examples:
 *               success:
 *                 summary: Successful visitor list
 *                 value:
 *                   success: true
 *                   visitors:
 *                     - id: "123e4567-e89b-12d3-a456-426614174000"
 *                       userId: "123e4567-e89b-12d3-a456-426614174001"
 *                       name: "Jane Smith"
 *                       title: "Marketing Director"
 *                       company: "Tech Corp Inc."
 *                       phone: "+1234567890"
 *                       email: "jane.smith@techcorp.com"
 *                       website: "https://www.techcorp.com"
 *                       interests: ["technology", "marketing", "innovation"]
 *                       notes: "Met at tech conference"
 *                       captureMethod: "business_card"
 *                       capturedAt: "2023-01-01T10:30:00.000Z"
 *                       createdAt: "2023-01-01T10:30:00.000Z"
 *                       updatedAt: "2023-01-01T10:30:00.000Z"
 *                       localId: "local_123456"
 *                       syncVersion: 1
 *                   pagination:
 *                     page: 1
 *                     limit: 20
 *                     total: 50
 *                     totalPages: 3
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
router.get(
  '/',
  visitorController.getVisitors
);

/**
 * @swagger
 * /api/visitors/{id}:
 *   get:
 *     summary: Get a specific visitor by ID
 *     description: |
 *       Retrieves a single visitor by their unique ID.
 *       Only returns visitors that belong to the authenticated user.
 *       Returns 404 if visitor doesn't exist or doesn't belong to user.
 *     tags: [Visitors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique visitor ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Visitor retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Visitor not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               not_found:
 *                 summary: Visitor not found
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "RESOURCE_NOT_FOUND"
 *                     message: "Visitor not found"
 *                     correlationId: "req_123456789"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:id',
  visitorController.getVisitorById
);

/**
 * @swagger
 * /api/visitors/{id}:
 *   put:
 *     summary: Update a visitor
 *     description: |
 *       Updates an existing visitor record with new information.
 *       Only the provided fields will be updated (partial update).
 *       Only visitors belonging to the authenticated user can be updated.
 *       Updates the sync version for mobile app synchronization.
 *     tags: [Visitors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique visitor ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateVisitorRequest'
 *           examples:
 *             partial_update:
 *               summary: Update title and interests
 *               value:
 *                 title: "Senior Marketing Director"
 *                 interests: ["technology", "marketing", "innovation", "AI"]
 *             full_update:
 *               summary: Update multiple fields
 *               value:
 *                 name: "Jane Smith-Johnson"
 *                 title: "VP of Marketing"
 *                 phone: "+1234567891"
 *                 interests: ["technology", "marketing", "innovation", "AI", "automation"]
 *                 notes: "Updated after follow-up meeting. Very interested in AI solutions."
 *     responses:
 *       200:
 *         description: Visitor updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitorResponse'
 *       400:
 *         description: Validation error
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
 *       404:
 *         description: Visitor not found
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
router.put(
  '/:id',
  validateRequest(updateVisitorSchema),
  visitorController.updateVisitor
);

/**
 * @swagger
 * /api/visitors/{id}:
 *   delete:
 *     summary: Delete a visitor
 *     description: |
 *       Soft deletes a visitor record (sets deletedAt timestamp).
 *       Only visitors belonging to the authenticated user can be deleted.
 *       Deleted visitors are excluded from normal queries but preserved for audit purposes.
 *       This operation cannot be undone through the API.
 *     tags: [Visitors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique visitor ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Visitor deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteResponse'
 *             examples:
 *               success:
 *                 summary: Successful deletion
 *                 value:
 *                   success: true
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Visitor not found
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
router.delete(
  '/:id',
  visitorController.deleteVisitor
);

/**
 * @swagger
 * /api/visitors/bulk-sync:
 *   post:
 *     summary: Bulk synchronize visitors from mobile app
 *     description: |
 *       Processes bulk visitor operations from the mobile app for offline-to-online synchronization.
 *       Supports create, update, and delete operations in a single request.
 *       Handles conflict detection and resolution based on timestamps and data comparison.
 *       Rate limited to 10 requests per 5 minutes to prevent abuse.
 *     tags: [Synchronization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [operations]
 *             properties:
 *               operations:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 1000
 *                 items:
 *                   type: object
 *                   required: [action, localId, timestamp]
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [create, update, delete]
 *                       description: Type of operation to perform
 *                     localId:
 *                       type: string
 *                       description: Local ID from mobile app
 *                     serverId:
 *                       type: string
 *                       description: Server ID for update/delete operations
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       description: When the operation was performed locally
 *                     data:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/CreateVisitorRequest'
 *                         - $ref: '#/components/schemas/UpdateVisitorRequest'
 *                       description: Visitor data (required for create/update)
 *               lastSyncTimestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Timestamp of last successful sync
 *           examples:
 *             mixed_operations:
 *               summary: Mixed create, update, delete operations
 *               value:
 *                 operations:
 *                   - action: "create"
 *                     localId: "local_001"
 *                     timestamp: "2023-01-01T10:30:00.000Z"
 *                     data:
 *                       name: "New Contact"
 *                       company: "New Company"
 *                       interests: ["technology"]
 *                       captureMethod: "business_card"
 *                       capturedAt: "2023-01-01T10:30:00.000Z"
 *                   - action: "update"
 *                     localId: "local_002"
 *                     serverId: "123e4567-e89b-12d3-a456-426614174000"
 *                     timestamp: "2023-01-01T11:00:00.000Z"
 *                     data:
 *                       title: "Updated Title"
 *                   - action: "delete"
 *                     localId: "local_003"
 *                     serverId: "123e4567-e89b-12d3-a456-426614174001"
 *                     timestamp: "2023-01-01T11:30:00.000Z"
 *                 lastSyncTimestamp: "2023-01-01T09:00:00.000Z"
 *     responses:
 *       200:
 *         description: Sync completed with results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, results, conflicts, errors, syncTimestamp]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       localId:
 *                         type: string
 *                       serverId:
 *                         type: string
 *                       action:
 *                         type: string
 *                         enum: [create, update, delete]
 *                       status:
 *                         type: string
 *                         enum: [success, conflict, error]
 *                       error:
 *                         type: string
 *                       conflictData:
 *                         type: object
 *                 conflicts:
 *                   type: array
 *                   items:
 *                     type: object
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                 syncTimestamp:
 *                   type: string
 *                   format: date-time
 *                 error:
 *                   type: string
 *       400:
 *         description: Validation error
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
 *       429:
 *         description: Rate limit exceeded
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
router.post(
  '/bulk-sync',
  validateRequest(bulkSyncSchema),
  visitorController.bulkSync
);

/**
 * @swagger
 * /api/visitors/sync/timestamp:
 *   get:
 *     summary: Get last sync timestamp
 *     description: |
 *       Retrieves the timestamp of the last successful sync for the authenticated user.
 *       Used by mobile app to determine which local changes need to be synced.
 *       Returns null if no sync has been performed yet.
 *     tags: [Synchronization]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Last sync timestamp retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 lastSyncTimestamp:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   example: "2023-01-01T12:00:00.000Z"
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
router.get(
  '/sync/timestamp',
  visitorController.getLastSyncTimestamp
);

/**
 * @swagger
 * /api/visitors/sync/resolve-conflicts:
 *   post:
 *     summary: Resolve sync conflicts
 *     description: |
 *       Resolves conflicts that occurred during bulk sync operations.
 *       Allows manual resolution of conflicts using different strategies.
 *       Supports server wins, client wins, merge, and manual resolution strategies.
 *     tags: [Synchronization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [conflicts]
 *             properties:
 *               conflicts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [localId, strategy]
 *                   properties:
 *                     localId:
 *                       type: string
 *                       description: Local ID of conflicted record
 *                     strategy:
 *                       type: string
 *                       enum: [server_wins, client_wins, merge, manual]
 *                       description: Resolution strategy to apply
 *                     resolvedData:
 *                       type: object
 *                       description: Manually resolved data (required for manual strategy)
 *     responses:
 *       200:
 *         description: Conflicts resolved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 resolved:
 *                   type: array
 *                   items:
 *                     type: object
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
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
router.post(
  '/sync/resolve-conflicts',
  visitorController.resolveConflicts
);

/**
 * @swagger
 * /api/visitors/sync/progress/{sessionId}:
 *   get:
 *     summary: Get sync progress for a session
 *     description: |
 *       Retrieves the progress of an ongoing sync operation.
 *       Used for long-running sync operations to provide progress feedback.
 *       Returns completion percentage and current status.
 *     tags: [Synchronization]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Sync session ID
 *     responses:
 *       200:
 *         description: Sync progress retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 progress:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, in_progress, completed, failed]
 *                     percentage:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                     processed:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     errors:
 *                       type: integer
 *                     conflicts:
 *                       type: integer
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Session not found
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
router.get(
  '/sync/progress/:sessionId',
  visitorController.getSyncProgress
);

/**
 * @swagger
 * /api/visitors/sync/history:
 *   get:
 *     summary: Get sync history
 *     description: |
 *       Retrieves the history of sync operations for the authenticated user.
 *       Includes timestamps, operation counts, and success/failure status.
 *       Supports pagination for large sync histories.
 *     tags: [Synchronization]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Sync history retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
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
router.get(
  '/sync/history',
  visitorController.getSyncHistory
);

/**
 * @swagger
 * /api/visitors/sync/mappings:
 *   get:
 *     summary: Get local ID mappings
 *     description: |
 *       Retrieves mappings between local IDs (from mobile app) and server IDs.
 *       Used by mobile app to update local database with server-generated IDs.
 *       Essential for maintaining data consistency across offline/online modes.
 *     tags: [Synchronization]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ID mappings retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 mappings:
 *                   type: object
 *                   additionalProperties:
 *                     type: string
 *                   example:
 *                     "local_001": "123e4567-e89b-12d3-a456-426614174000"
 *                     "local_002": "123e4567-e89b-12d3-a456-426614174001"
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
router.get(
  '/sync/mappings',
  visitorController.getLocalIdMappings
);

/**
 * @swagger
 * /api/visitors/sync/conflicts/statistics:
 *   get:
 *     summary: Get conflict statistics
 *     description: |
 *       Retrieves statistics about sync conflicts for the authenticated user.
 *       Includes conflict counts by type, resolution strategies used, and trends.
 *       Useful for monitoring sync health and identifying problematic patterns.
 *     tags: [Synchronization]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conflict statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalConflicts:
 *                       type: integer
 *                       example: 15
 *                     resolvedConflicts:
 *                       type: integer
 *                       example: 12
 *                     pendingConflicts:
 *                       type: integer
 *                       example: 3
 *                     byResolutionStrategy:
 *                       type: object
 *                       properties:
 *                         server_wins:
 *                           type: integer
 *                           example: 8
 *                         client_wins:
 *                           type: integer
 *                           example: 2
 *                         merge:
 *                           type: integer
 *                           example: 2
 *                         manual:
 *                           type: integer
 *                           example: 0
 *                     byConflictType:
 *                       type: object
 *                       properties:
 *                         data_mismatch:
 *                           type: integer
 *                           example: 10
 *                         timestamp_conflict:
 *                           type: integer
 *                           example: 5
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
router.get(
  '/sync/conflicts/statistics',
  visitorController.getConflictStatistics
);

export { router as visitorRoutes };