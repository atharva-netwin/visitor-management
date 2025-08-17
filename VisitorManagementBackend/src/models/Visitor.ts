import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { CreateVisitorRequest, UpdateVisitorRequest, VisitorProfile, VisitorFilters } from '../types';
import { logger } from '../utils/logger';

export class Visitor {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(userId: string, visitorData: CreateVisitorRequest): Promise<VisitorProfile> {
    const client = await this.pool.connect();

    try {
      const id = uuidv4();
      const query = `
        INSERT INTO visitors (
          id, user_id, name, title, company, phone, email, website, 
          interests, notes, capture_method, captured_at, local_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const values = [
        id,
        userId,
        visitorData.name,
        visitorData.title || null,
        visitorData.company,
        visitorData.phone || null,
        visitorData.email || null,
        visitorData.website || null,
        JSON.stringify(visitorData.interests),
        visitorData.notes || null,
        visitorData.captureMethod,
        visitorData.capturedAt,
        visitorData.localId || null
      ];

      const result = await client.query(query, values);
      const visitor = this.mapRowToVisitor(result.rows[0]);

      logger.info('Visitor created successfully', {
        visitorId: visitor.id,
        userId,
        company: visitor.company
      });

      return visitor;
    } catch (error) {
      logger.error('Error creating visitor', { error, userId, visitorData });
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string, userId: string): Promise<VisitorProfile | null> {
    const client = await this.pool.connect();

    try {
      const query = 'SELECT * FROM visitors WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL';
      const result = await client.query(query, [id, userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToVisitor(result.rows[0]);
    } catch (error) {
      logger.error('Error finding visitor by ID', { error, id, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  async findByUserId(userId: string, filters: VisitorFilters = {}): Promise<{ visitors: VisitorProfile[], total: number }> {
    const client = await this.pool.connect();

    try {
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100); // Max 100 per page
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const conditions = ['user_id = $1', 'deleted_at IS NULL'];
      const values: any[] = [userId];
      let paramCount = 1;

      if (filters.company) {
        paramCount++;
        conditions.push(`company ILIKE $${paramCount}`);
        values.push(`%${filters.company}%`);
      }

      if (filters.captureMethod) {
        paramCount++;
        conditions.push(`capture_method = $${paramCount}`);
        values.push(filters.captureMethod);
      }

      if (filters.interests && filters.interests.length > 0) {
        paramCount++;
        conditions.push(`interests ?| $${paramCount}`);
        values.push(filters.interests);
      }

      if (filters.startDate) {
        paramCount++;
        conditions.push(`captured_at >= $${paramCount}`);
        values.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        conditions.push(`captured_at <= $${paramCount}`);
        values.push(filters.endDate);
      }

      if (filters.search) {
        paramCount++;
        conditions.push(`(name ILIKE $${paramCount} OR company ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
        values.push(`%${filters.search}%`);
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM visitors WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const query = `
        SELECT * FROM visitors 
        WHERE ${whereClause}
        ORDER BY captured_at DESC, created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      values.push(limit, offset);
      const result = await client.query(query, values);

      const visitors = result.rows.map(row => this.mapRowToVisitor(row));

      return { visitors, total };
    } catch (error) {
      logger.error('Error finding visitors by user ID', { error, userId, filters });
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, userId: string, updates: UpdateVisitorRequest): Promise<VisitorProfile | null> {
    const client = await this.pool.connect();

    try {
      // Build SET clause dynamically
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      const updateFields = [
        'name', 'title', 'company', 'phone', 'email', 'website',
        'notes', 'captureMethod', 'capturedAt'
      ];

      updateFields.forEach(field => {
        const dbField = field === 'captureMethod' ? 'capture_method' :
          field === 'capturedAt' ? 'captured_at' :
            field.toLowerCase();

        if (updates[field as keyof UpdateVisitorRequest] !== undefined) {
          paramCount++;
          setClauses.push(`${dbField} = $${paramCount}`);
          values.push(updates[field as keyof UpdateVisitorRequest]);
        }
      });

      if (updates.interests !== undefined) {
        paramCount++;
        setClauses.push(`interests = $${paramCount}`);
        values.push(JSON.stringify(updates.interests));
      }

      if (setClauses.length === 0) {
        // No updates provided, return current visitor
        return await this.findById(id, userId);
      }

      // Add updated_at
      paramCount++;
      setClauses.push(`updated_at = $${paramCount}`);
      values.push(new Date().toISOString());

      // Add WHERE conditions
      paramCount++;
      values.push(id);
      paramCount++;
      values.push(userId);

      const query = `
        UPDATE visitors 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramCount - 1} AND user_id = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const visitor = this.mapRowToVisitor(result.rows[0]);

      logger.info('Visitor updated successfully', {
        visitorId: visitor.id,
        userId,
        updatedFields: Object.keys(updates)
      });

      return visitor;
    } catch (error) {
      logger.error('Error updating visitor', { error, id, userId, updates });
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string, userId: string, softDelete: boolean = true): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      let query: string;
      let values: any[];

      if (softDelete) {
        // Soft delete: add deleted_at timestamp
        query = `
          UPDATE visitors 
          SET deleted_at = $1, updated_at = $1
          WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
        `;
        values = [new Date().toISOString(), id, userId];
      } else {
        // Hard delete: actually remove from database
        query = 'DELETE FROM visitors WHERE id = $1 AND user_id = $2';
        values = [id, userId];
      }

      const result = await client.query(query, values);
      const deleted = (result.rowCount || 0) > 0;

      if (deleted) {
        logger.info(`Visitor ${softDelete ? 'soft' : 'hard'} deleted successfully`, {
          visitorId: id,
          userId,
          softDelete
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting visitor', { error, id, userId, softDelete });
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRowToVisitor(row: any): VisitorProfile {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      title: row.title,
      company: row.company,
      phone: row.phone,
      email: row.email,
      website: row.website,
      interests: typeof row.interests === 'string' ? JSON.parse(row.interests) : row.interests,
      notes: row.notes,
      captureMethod: row.capture_method,
      capturedAt: row.captured_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      localId: row.local_id,
      syncVersion: row.sync_version
    };
  }
}