# SDK Examples and Integration Code

This document provides complete SDK examples and integration code for various platforms and frameworks.

## JavaScript/TypeScript SDK

### Complete SDK Implementation

```typescript
// visitor-management-sdk.ts
export interface VisitorData {
  id?: string;
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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SyncOperation {
  action: 'create' | 'update' | 'delete';
  localId: string;
  data?: VisitorData;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    correlationId: string;
  };
}

export class VisitorManagementSDK {
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefresh?: (tokens: AuthTokens) => void;

  constructor(baseURL: string, onTokenRefresh?: (tokens: AuthTokens) => void) {
    this.baseURL = baseURL.replace(/\/$/, '');
    this.onTokenRefresh = onTokenRefresh;
  }

  // Authentication Methods
  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<ApiResponse<{ user: any; accessToken: string; refreshToken: string }>> {
    const response = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.success && response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }

    return response;
  }

  async login(credentials: {
    email: string;
    password: string;
  }): Promise<ApiResponse<{ user: any; accessToken: string; refreshToken: string }>> {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.success && response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }

    return response;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('/api/auth/logout', {
      method: 'POST',
    });

    this.clearTokens();
    return response;
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await this.request('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.success && response.data) {
        this.setTokens(response.data.accessToken, response.data.refreshToken);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  // Visitor Management Methods
  async createVisitor(visitorData: Omit<VisitorData, 'id'>): Promise<ApiResponse<VisitorData>> {
    return this.request('/api/visitors', {
      method: 'POST',
      body: JSON.stringify(visitorData),
    });
  }

  async getVisitors(params?: {
    page?: number;
    limit?: number;
    search?: string;
    company?: string;
    captureMethod?: string;
  }): Promise<ApiResponse<{ visitors: VisitorData[]; total: number; page: number; limit: number }>> {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request(`/api/visitors${queryString}`);
  }

  async getVisitor(id: string): Promise<ApiResponse<VisitorData>> {
    return this.request(`/api/visitors/${id}`);
  }

  async updateVisitor(id: string, updates: Partial<VisitorData>): Promise<ApiResponse<VisitorData>> {
    return this.request(`/api/visitors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteVisitor(id: string): Promise<ApiResponse> {
    return this.request(`/api/visitors/${id}`, {
      method: 'DELETE',
    });
  }

  // Sync Methods
  async bulkSync(operations: SyncOperation[]): Promise<ApiResponse<{
    successful: Array<{ localId: string; serverId: string; data: VisitorData }>;
    failed: Array<{ localId: string; error: string }>;
    conflicts: Array<{ localId: string; serverData: VisitorData; clientData: VisitorData }>;
  }>> {
    return this.request('/api/visitors/bulk-sync', {
      method: 'POST',
      body: JSON.stringify({ operations }),
    });
  }

  // Analytics Methods
  async getDailyStats(date: string): Promise<ApiResponse<{
    date: string;
    totalVisitors: number;
    byCompany: Record<string, number>;
    byCaptureMethod: Record<string, number>;
  }>> {
    return this.request(`/api/analytics/daily/${date}`);
  }

  async getMonthlyStats(year: number, month: number): Promise<ApiResponse<{
    year: number;
    month: number;
    totalVisitors: number;
    dailyBreakdown: Array<{ date: string; count: number }>;
    topCompanies: Array<{ company: string; count: number }>;
  }>> {
    return this.request(`/api/analytics/monthly/${year}/${month}`);
  }

  async exportData(format: 'csv' | 'json', filters?: {
    startDate?: string;
    endDate?: string;
    company?: string;
  }): Promise<ApiResponse<{ downloadUrl: string }>> {
    const params = { format, ...filters };
    const queryString = '?' + new URLSearchParams(params as any).toString();
    return this.request(`/api/analytics/export${queryString}`);
  }

  // Utility Methods
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    
    if (this.onTokenRefresh) {
      this.onTokenRefresh({ accessToken, refreshToken });
    }
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // Private Methods
  private async request(endpoint: string, options: RequestInit = {}): Promise<ApiResponse> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle token expiration
      if (response.status === 401 && this.accessToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the original request with new token
          headers.Authorization = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers,
          });
          return retryResponse.json();
        }
      }

      return response.json();
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
          correlationId: 'client-error',
        },
      };
    }
  }
}

// Usage Example
const sdk = new VisitorManagementSDK('https://your-api.com', (tokens) => {
  // Save tokens to secure storage
  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
});

// Restore tokens on app start
const savedAccessToken = localStorage.getItem('accessToken');
const savedRefreshToken = localStorage.getItem('refreshToken');
if (savedAccessToken && savedRefreshToken) {
  sdk.setTokens(savedAccessToken, savedRefreshToken);
}
```

## React Native Integration

### Complete React Native Service

```typescript
// services/VisitorManagementService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { VisitorManagementSDK, VisitorData, SyncOperation } from './visitor-management-sdk';

export class VisitorManagementService {
  private sdk: VisitorManagementSDK;
  private isOnline: boolean = true;
  private syncQueue: SyncOperation[] = [];

  constructor(apiUrl: string) {
    this.sdk = new VisitorManagementSDK(apiUrl, this.handleTokenRefresh);
    this.initializeNetworkListener();
    this.restoreTokens();
  }

  private async handleTokenRefresh(tokens: { accessToken: string; refreshToken: string }) {
    await AsyncStorage.setItem('accessToken', tokens.accessToken);
    await AsyncStorage.setItem('refreshToken', tokens.refreshToken);
  }

  private async restoreTokens() {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (accessToken && refreshToken) {
        this.sdk.setTokens(accessToken, refreshToken);
      }
    } catch (error) {
      console.error('Failed to restore tokens:', error);
    }
  }

  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      // If we just came back online, sync pending changes
      if (wasOffline && this.isOnline) {
        this.syncPendingChanges();
      }
    });
  }

  // Authentication Methods
  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    if (!this.isOnline) {
      throw new Error('Registration requires internet connection');
    }
    
    return this.sdk.register(userData);
  }

  async login(credentials: { email: string; password: string }) {
    if (!this.isOnline) {
      throw new Error('Login requires internet connection');
    }
    
    return this.sdk.login(credentials);
  }

  async logout() {
    if (this.isOnline) {
      await this.sdk.logout();
    }
    
    // Clear local data
    await AsyncStorage.multiRemove([
      'accessToken',
      'refreshToken',
      'syncQueue',
      'localVisitors'
    ]);
    
    this.syncQueue = [];
  }

  // Visitor Management with Offline Support
  async createVisitor(visitorData: Omit<VisitorData, 'id'>) {
    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const visitorWithLocalId = { ...visitorData, localId };

    if (this.isOnline) {
      try {
        const response = await this.sdk.createVisitor(visitorWithLocalId);
        if (response.success) {
          return response;
        }
      } catch (error) {
        console.error('Online create failed, falling back to offline:', error);
      }
    }

    // Store locally and queue for sync
    await this.storeVisitorLocally(visitorWithLocalId);
    await this.queueSyncOperation({
      action: 'create',
      localId,
      data: visitorWithLocalId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      data: { ...visitorWithLocalId, id: localId },
    };
  }

  async updateVisitor(id: string, updates: Partial<VisitorData>) {
    if (this.isOnline && !id.startsWith('local_')) {
      try {
        const response = await this.sdk.updateVisitor(id, updates);
        if (response.success) {
          return response;
        }
      } catch (error) {
        console.error('Online update failed, falling back to offline:', error);
      }
    }

    // Update locally and queue for sync
    await this.updateVisitorLocally(id, updates);
    await this.queueSyncOperation({
      action: 'update',
      localId: id,
      data: updates,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  async deleteVisitor(id: string) {
    if (this.isOnline && !id.startsWith('local_')) {
      try {
        const response = await this.sdk.deleteVisitor(id);
        if (response.success) {
          await this.removeVisitorLocally(id);
          return response;
        }
      } catch (error) {
        console.error('Online delete failed, falling back to offline:', error);
      }
    }

    // Mark as deleted locally and queue for sync
    await this.markVisitorDeletedLocally(id);
    await this.queueSyncOperation({
      action: 'delete',
      localId: id,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  async getVisitors(params?: any) {
    if (this.isOnline) {
      try {
        const response = await this.sdk.getVisitors(params);
        if (response.success) {
          // Cache the results locally
          await this.cacheVisitors(response.data.visitors);
          return response;
        }
      } catch (error) {
        console.error('Online fetch failed, falling back to offline:', error);
      }
    }

    // Return local data
    const localVisitors = await this.getLocalVisitors();
    return {
      success: true,
      data: {
        visitors: localVisitors,
        total: localVisitors.length,
        page: 1,
        limit: localVisitors.length,
      },
    };
  }

  // Sync Methods
  async syncPendingChanges() {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    try {
      const response = await this.sdk.bulkSync(this.syncQueue);
      
      if (response.success) {
        // Handle successful syncs
        for (const success of response.data.successful) {
          await this.handleSyncSuccess(success);
        }

        // Handle conflicts
        for (const conflict of response.data.conflicts) {
          await this.handleSyncConflict(conflict);
        }

        // Remove successful operations from queue
        this.syncQueue = this.syncQueue.filter(op => 
          !response.data.successful.some(s => s.localId === op.localId)
        );

        await this.saveSyncQueue();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  // Private Methods
  private async storeVisitorLocally(visitor: VisitorData) {
    try {
      const existingVisitors = await this.getLocalVisitors();
      const updatedVisitors = [...existingVisitors, visitor];
      await AsyncStorage.setItem('localVisitors', JSON.stringify(updatedVisitors));
    } catch (error) {
      console.error('Failed to store visitor locally:', error);
    }
  }

  private async updateVisitorLocally(id: string, updates: Partial<VisitorData>) {
    try {
      const existingVisitors = await this.getLocalVisitors();
      const updatedVisitors = existingVisitors.map(visitor => 
        (visitor.id === id || visitor.localId === id) 
          ? { ...visitor, ...updates }
          : visitor
      );
      await AsyncStorage.setItem('localVisitors', JSON.stringify(updatedVisitors));
    } catch (error) {
      console.error('Failed to update visitor locally:', error);
    }
  }

  private async removeVisitorLocally(id: string) {
    try {
      const existingVisitors = await this.getLocalVisitors();
      const filteredVisitors = existingVisitors.filter(visitor => 
        visitor.id !== id && visitor.localId !== id
      );
      await AsyncStorage.setItem('localVisitors', JSON.stringify(filteredVisitors));
    } catch (error) {
      console.error('Failed to remove visitor locally:', error);
    }
  }

  private async markVisitorDeletedLocally(id: string) {
    try {
      const existingVisitors = await this.getLocalVisitors();
      const updatedVisitors = existingVisitors.map(visitor => 
        (visitor.id === id || visitor.localId === id)
          ? { ...visitor, deleted: true }
          : visitor
      );
      await AsyncStorage.setItem('localVisitors', JSON.stringify(updatedVisitors));
    } catch (error) {
      console.error('Failed to mark visitor as deleted:', error);
    }
  }

  private async getLocalVisitors(): Promise<VisitorData[]> {
    try {
      const stored = await AsyncStorage.getItem('localVisitors');
      const visitors = stored ? JSON.parse(stored) : [];
      return visitors.filter((v: any) => !v.deleted);
    } catch (error) {
      console.error('Failed to get local visitors:', error);
      return [];
    }
  }

  private async cacheVisitors(visitors: VisitorData[]) {
    try {
      await AsyncStorage.setItem('localVisitors', JSON.stringify(visitors));
    } catch (error) {
      console.error('Failed to cache visitors:', error);
    }
  }

  private async queueSyncOperation(operation: SyncOperation) {
    this.syncQueue.push(operation);
    await this.saveSyncQueue();
  }

  private async saveSyncQueue() {
    try {
      await AsyncStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  private async loadSyncQueue() {
    try {
      const stored = await AsyncStorage.getItem('syncQueue');
      this.syncQueue = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  private async handleSyncSuccess(success: any) {
    // Update local record with server ID
    await this.updateVisitorLocally(success.localId, {
      id: success.serverId,
      ...success.data,
    });
  }

  private async handleSyncConflict(conflict: any) {
    // For now, server wins - in a real app, you might want to show a UI
    await this.updateVisitorLocally(conflict.localId, conflict.serverData);
  }
}
```

### React Native Hook

```typescript
// hooks/useVisitorManagement.ts
import { useState, useEffect, useCallback } from 'react';
import { VisitorManagementService } from '../services/VisitorManagementService';
import { VisitorData } from '../services/visitor-management-sdk';

const service = new VisitorManagementService('https://your-api.com');

export const useVisitorManagement = () => {
  const [visitors, setVisitors] = useState<VisitorData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await service.getVisitors();
      if (response.success) {
        setVisitors(response.data.visitors);
      } else {
        setError(response.error?.message || 'Failed to load visitors');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createVisitor = useCallback(async (visitorData: Omit<VisitorData, 'id'>) => {
    try {
      const response = await service.createVisitor(visitorData);
      if (response.success) {
        await loadVisitors(); // Refresh the list
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Failed to create visitor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [loadVisitors]);

  const updateVisitor = useCallback(async (id: string, updates: Partial<VisitorData>) => {
    try {
      const response = await service.updateVisitor(id, updates);
      if (response.success) {
        await loadVisitors(); // Refresh the list
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Failed to update visitor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [loadVisitors]);

  const deleteVisitor = useCallback(async (id: string) => {
    try {
      const response = await service.deleteVisitor(id);
      if (response.success) {
        await loadVisitors(); // Refresh the list
      } else {
        throw new Error(response.error?.message || 'Failed to delete visitor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [loadVisitors]);

  const syncData = useCallback(async () => {
    try {
      await service.syncPendingChanges();
      await loadVisitors(); // Refresh after sync
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    }
  }, [loadVisitors]);

  useEffect(() => {
    loadVisitors();
  }, [loadVisitors]);

  return {
    visitors,
    loading,
    error,
    loadVisitors,
    createVisitor,
    updateVisitor,
    deleteVisitor,
    syncData,
    service, // Expose service for direct access if needed
  };
};
```

## Web Application Integration

### React Web Integration

```typescript
// hooks/useAuth.ts
import { useState, useEffect, createContext, useContext } from 'react';
import { VisitorManagementSDK } from '../services/visitor-management-sdk';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const sdk = new VisitorManagementSDK('https://your-api.com', (tokens) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  });

  useEffect(() => {
    // Restore session on app start
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (accessToken && refreshToken) {
      sdk.setTokens(accessToken, refreshToken);
      setIsAuthenticated(true);
      // You might want to validate the token here
    }
    
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await sdk.login({ email, password });
    
    if (response.success) {
      setIsAuthenticated(true);
      setUser(response.data.user);
    } else {
      throw new Error(response.error?.message || 'Login failed');
    }
  };

  const register = async (userData: any) => {
    const response = await sdk.register(userData);
    
    if (response.success) {
      setIsAuthenticated(true);
      setUser(response.data.user);
    } else {
      throw new Error(response.error?.message || 'Registration failed');
    }
  };

  const logout = async () => {
    await sdk.logout();
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      login,
      register,
      logout,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## Python SDK

```python
# visitor_management_sdk.py
import requests
import json
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta

class VisitorManagementSDK:
    def __init__(self, base_url: str, on_token_refresh=None):
        self.base_url = base_url.rstrip('/')
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.on_token_refresh = on_token_refresh
        self.session = requests.Session()
    
    def set_tokens(self, access_token: str, refresh_token: str):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.session.headers.update({'Authorization': f'Bearer {access_token}'})
        
        if self.on_token_refresh:
            self.on_token_refresh(access_token, refresh_token)
    
    def clear_tokens(self):
        self.access_token = None
        self.refresh_token = None
        if 'Authorization' in self.session.headers:
            del self.session.headers['Authorization']
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            
            # Handle token expiration
            if response.status_code == 401 and self.access_token:
                if self._refresh_access_token():
                    # Retry with new token
                    response = self.session.request(method, url, **kwargs)
            
            return response.json()
        except requests.RequestException as e:
            return {
                'success': False,
                'error': {
                    'code': 'NETWORK_ERROR',
                    'message': str(e),
                    'correlationId': 'client-error'
                }
            }
    
    def _refresh_access_token(self) -> bool:
        if not self.refresh_token:
            return False
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/refresh",
                json={'refreshToken': self.refresh_token}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.set_tokens(data['data']['accessToken'], data['data']['refreshToken'])
                    return True
        except Exception as e:
            print(f"Token refresh failed: {e}")
        
        return False
    
    # Authentication methods
    def register(self, email: str, password: str, first_name: str, last_name: str) -> Dict[str, Any]:
        response = self._request('POST', '/api/auth/register', json={
            'email': email,
            'password': password,
            'firstName': first_name,
            'lastName': last_name
        })
        
        if response.get('success') and response.get('data'):
            self.set_tokens(response['data']['accessToken'], response['data']['refreshToken'])
        
        return response
    
    def login(self, email: str, password: str) -> Dict[str, Any]:
        response = self._request('POST', '/api/auth/login', json={
            'email': email,
            'password': password
        })
        
        if response.get('success') and response.get('data'):
            self.set_tokens(response['data']['accessToken'], response['data']['refreshToken'])
        
        return response
    
    def logout(self) -> Dict[str, Any]:
        response = self._request('POST', '/api/auth/logout')
        self.clear_tokens()
        return response
    
    # Visitor management methods
    def create_visitor(self, visitor_data: Dict[str, Any]) -> Dict[str, Any]:
        return self._request('POST', '/api/visitors', json=visitor_data)
    
    def get_visitors(self, **params) -> Dict[str, Any]:
        return self._request('GET', '/api/visitors', params=params)
    
    def get_visitor(self, visitor_id: str) -> Dict[str, Any]:
        return self._request('GET', f'/api/visitors/{visitor_id}')
    
    def update_visitor(self, visitor_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        return self._request('PUT', f'/api/visitors/{visitor_id}', json=updates)
    
    def delete_visitor(self, visitor_id: str) -> Dict[str, Any]:
        return self._request('DELETE', f'/api/visitors/{visitor_id}')
    
    def bulk_sync(self, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self._request('POST', '/api/visitors/bulk-sync', json={'operations': operations})
    
    # Analytics methods
    def get_daily_stats(self, date: str) -> Dict[str, Any]:
        return self._request('GET', f'/api/analytics/daily/{date}')
    
    def get_monthly_stats(self, year: int, month: int) -> Dict[str, Any]:
        return self._request('GET', f'/api/analytics/monthly/{year}/{month}')
    
    def export_data(self, format: str = 'json', **filters) -> Dict[str, Any]:
        params = {'format': format, **filters}
        return self._request('GET', '/api/analytics/export', params=params)

# Usage example
if __name__ == "__main__":
    # Initialize SDK
    def on_token_refresh(access_token, refresh_token):
        # Save tokens to secure storage
        print(f"Tokens refreshed: {access_token[:10]}...")
    
    sdk = VisitorManagementSDK('https://your-api.com', on_token_refresh)
    
    # Register or login
    response = sdk.login('user@example.com', 'password123')
    if response['success']:
        print("Login successful!")
        
        # Create a visitor
        visitor_response = sdk.create_visitor({
            'name': 'John Doe',
            'company': 'Tech Corp',
            'email': 'john@techcorp.com',
            'interests': ['technology', 'innovation'],
            'captureMethod': 'business_card',
            'capturedAt': datetime.now().isoformat()
        })
        
        if visitor_response['success']:
            print(f"Visitor created: {visitor_response['data']['id']}")
        
        # Get visitors
        visitors_response = sdk.get_visitors(limit=10)
        if visitors_response['success']:
            print(f"Found {len(visitors_response['data']['visitors'])} visitors")
    else:
        print(f"Login failed: {response['error']['message']}")
```

## cURL Examples

### Authentication Flow

```bash
# Register a new user
curl -X POST https://your-api.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST https://your-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'

# Refresh token
curl -X POST https://your-api.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'

# Logout
curl -X POST https://your-api.com/api/auth/logout \
  -H "Authorization: Bearer your_access_token_here"
```

### Visitor Management

```bash
# Create visitor
curl -X POST https://your-api.com/api/visitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_token_here" \
  -d '{
    "name": "Jane Smith",
    "company": "Tech Corp",
    "email": "jane@techcorp.com",
    "phone": "+1-555-0123",
    "interests": ["technology", "innovation"],
    "captureMethod": "business_card",
    "capturedAt": "2024-01-15T10:30:00.000Z"
  }'

# Get visitors with pagination
curl -X GET "https://your-api.com/api/visitors?page=1&limit=10&search=tech" \
  -H "Authorization: Bearer your_access_token_here"

# Update visitor
curl -X PUT https://your-api.com/api/visitors/visitor_id_here \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_token_here" \
  -d '{
    "notes": "Updated notes for this visitor"
  }'

# Delete visitor
curl -X DELETE https://your-api.com/api/visitors/visitor_id_here \
  -H "Authorization: Bearer your_access_token_here"
```

### Bulk Sync

```bash
curl -X POST https://your-api.com/api/visitors/bulk-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_token_here" \
  -d '{
    "operations": [
      {
        "action": "create",
        "localId": "local-123",
        "data": {
          "name": "Bob Johnson",
          "company": "StartupXYZ",
          "captureMethod": "event_badge",
          "capturedAt": "2024-01-15T09:15:00.000Z"
        },
        "timestamp": "2024-01-15T09:15:00.000Z"
      },
      {
        "action": "update",
        "localId": "local-456",
        "data": {
          "notes": "Updated notes"
        },
        "timestamp": "2024-01-15T09:20:00.000Z"
      }
    ]
  }'
```

### Analytics

```bash
# Daily stats
curl -X GET https://your-api.com/api/analytics/daily/2024-01-15 \
  -H "Authorization: Bearer your_access_token_here"

# Monthly stats
curl -X GET https://your-api.com/api/analytics/monthly/2024/1 \
  -H "Authorization: Bearer your_access_token_here"

# Export data
curl -X GET "https://your-api.com/api/analytics/export?format=csv&startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer your_access_token_here"
```

---

These SDK examples provide complete, production-ready integration code for various platforms. Each example includes proper error handling, token management, and offline support where applicable.