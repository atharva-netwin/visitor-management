import { db } from '@/database';
import { UserProfile } from '@/types';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  lastLoginAt?: Date;
}

export class User {
  static async create(userData: CreateUserData): Promise<UserProfile> {
    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, first_name as "firstName", last_name as "lastName", 
                is_active as "isActive", created_at as "createdAt", 
                updated_at as "updatedAt", last_login_at as "lastLoginAt"
    `;
    
    const values = [
      userData.email,
      userData.passwordHash,
      userData.firstName,
      userData.lastName
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<UserProfile | null> {
    const query = `
      SELECT id, email, first_name as "firstName", last_name as "lastName", 
             is_active as "isActive", created_at as "createdAt", 
             updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users 
      WHERE email = $1 AND is_active = true
    `;
    
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  static async findByEmailWithPassword(email: string): Promise<(UserProfile & { passwordHash: string }) | null> {
    const query = `
      SELECT id, email, password_hash as "passwordHash", 
             first_name as "firstName", last_name as "lastName", 
             is_active as "isActive", created_at as "createdAt", 
             updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users 
      WHERE email = $1 AND is_active = true
    `;
    
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  static async findById(id: string): Promise<UserProfile | null> {
    const query = `
      SELECT id, email, first_name as "firstName", last_name as "lastName", 
             is_active as "isActive", created_at as "createdAt", 
             updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users 
      WHERE id = $1 AND is_active = true
    `;
    
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  static async update(id: string, updates: UpdateUserData): Promise<UserProfile | null> {
    const setClause = [];
    const values = [];
    let paramCount = 1;

    if (updates.firstName !== undefined) {
      setClause.push(`first_name = $${paramCount++}`);
      values.push(updates.firstName);
    }
    
    if (updates.lastName !== undefined) {
      setClause.push(`last_name = $${paramCount++}`);
      values.push(updates.lastName);
    }
    
    if (updates.isActive !== undefined) {
      setClause.push(`is_active = $${paramCount++}`);
      values.push(updates.isActive);
    }
    
    if (updates.lastLoginAt !== undefined) {
      setClause.push(`last_login_at = $${paramCount++}`);
      values.push(updates.lastLoginAt);
    }

    if (setClause.length === 0) {
      return this.findById(id);
    }

    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${setClause.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name as "firstName", last_name as "lastName", 
                is_active as "isActive", created_at as "createdAt", 
                updated_at as "updatedAt", last_login_at as "lastLoginAt"
    `;

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  static async emailExists(email: string): Promise<boolean> {
    const query = 'SELECT 1 FROM users WHERE email = $1 LIMIT 1';
    const result = await db.query(query, [email]);
    return result.rows.length > 0;
  }
}