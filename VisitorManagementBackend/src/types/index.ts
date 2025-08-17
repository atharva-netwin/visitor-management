// Authentication types
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

export interface TokenResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

export interface UserPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Visitor types
export interface CreateVisitorRequest {
  name: string;
  title?: string;
  company: string;
  phone?: string;
  email?: string;
  website?: string;
  interests: string[];
  notes?: string;
  captureMethod: 'business_card' | 'event_badge';
  capturedAt: string;
  localId?: string;
}

export interface UpdateVisitorRequest {
  name?: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
  interests?: string[];
  notes?: string;
  captureMethod?: 'business_card' | 'event_badge';
  capturedAt?: string;
}

export interface VisitorProfile {
  id: string;
  userId: string;
  name: string;
  title?: string;
  company: string;
  phone?: string;
  email?: string;
  website?: string;
  interests: string[];
  notes?: string;
  captureMethod: 'business_card' | 'event_badge';
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  localId?: string;
  syncVersion: number;
}

export interface VisitorResponse {
  success: boolean;
  visitor?: VisitorProfile;
  error?: string;
}

export interface VisitorListResponse {
  success: boolean;
  visitors?: VisitorProfile[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface VisitorFilters {
  page?: number;
  limit?: number;
  company?: string;
  captureMethod?: 'business_card' | 'event_badge';
  interests?: string[];
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface DeleteResponse {
  success: boolean;
  error?: string;
}

// Error types
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    correlationId: string;
  };
}

// Sync types
export interface SyncOperation {
  action: 'create' | 'update' | 'delete';
  localId: string;
  data?: CreateVisitorRequest | UpdateVisitorRequest;
  timestamp: string;
  serverId?: string; // For update/delete operations
}

export interface BulkSyncRequest {
  operations: SyncOperation[];
  lastSyncTimestamp?: string;
}

export interface SyncResult {
  localId: string;
  serverId?: string;
  action: 'create' | 'update' | 'delete';
  status: 'success' | 'conflict' | 'error';
  error?: string;
  conflictData?: {
    clientData: any;
    serverData: any;
    conflictFields: string[];
  };
}

export interface BulkSyncResponse {
  success: boolean;
  results: SyncResult[];
  conflicts: SyncResult[];
  errors: SyncResult[];
  syncTimestamp: string;
  error?: string;
}

export interface ConflictResolution {
  strategy: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  resolvedData?: any;
  requiresManualReview?: boolean;
}

// Analytics types
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
  data?: string;
  filename?: string;
  contentType?: string;
  error?: string;
}

export enum ErrorCodes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SYNC_CONFLICT = 'SYNC_CONFLICT'
}