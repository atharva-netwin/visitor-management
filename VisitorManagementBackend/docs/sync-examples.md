# Synchronization Examples and Conflict Resolution

This document provides comprehensive examples of synchronization operations, conflict resolution scenarios, and best practices for implementing robust offline-to-online data sync.

## Overview

The synchronization system handles:
- **Bulk operations** for efficient data transfer
- **Conflict detection** based on timestamps and data comparison
- **Multiple resolution strategies** for different conflict types
- **Partial sync handling** with detailed error reporting
- **Progress tracking** for long-running operations

## Basic Sync Operations

### 1. Simple Create Operation

```javascript
// Mobile app creates a new visitor offline
const newVisitor = {
  name: "John Smith",
  company: "Tech Corp",
  email: "john@techcorp.com",
  interests: ["technology", "innovation"],
  captureMethod: "business_card",
  capturedAt: "2023-12-01T10:30:00.000Z"
};

// Store locally with generated ID
const localId = await DatabaseService.createVisitor(newVisitor);

// When online, sync to server
const syncRequest = {
  operations: [{
    action: "create",
    localId: localId,
    timestamp: "2023-12-01T10:30:00.000Z",
    data: newVisitor
  }],
  lastSyncTimestamp: "2023-12-01T09:00:00.000Z"
};

const response = await fetch('/api/visitors/bulk-sync', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(syncRequest)
});

const result = await response.json();
// Result:
{
  "success": true,
  "results": [{
    "localId": "local_123456",
    "serverId": "uuid-server-789",
    "action": "create",
    "status": "success"
  }],
  "conflicts": [],
  "errors": [],
  "syncTimestamp": "2023-12-01T10:35:00.000Z"
}
```

### 2. Bulk Mixed Operations

```javascript
// Multiple operations in a single sync request
const bulkSyncRequest = {
  operations: [
    // Create new visitor
    {
      action: "create",
      localId: "local_001",
      timestamp: "2023-12-01T10:30:00.000Z",
      data: {
        name: "Alice Johnson",
        company: "Innovation Labs",
        interests: ["AI", "machine learning"],
        captureMethod: "event_badge",
        capturedAt: "2023-12-01T10:30:00.000Z"
      }
    },
    // Update existing visitor
    {
      action: "update",
      localId: "local_002",
      serverId: "uuid-existing-456",
      timestamp: "2023-12-01T11:00:00.000Z",
      data: {
        title: "Senior Developer",
        interests: ["technology", "programming", "AI"]
      }
    },
    // Delete visitor
    {
      action: "delete",
      localId: "local_003",
      serverId: "uuid-to-delete-789",
      timestamp: "2023-12-01T11:15:00.000Z"
    }
  ],
  lastSyncTimestamp: "2023-12-01T09:00:00.000Z"
};

// Server response with mixed results
{
  "success": true,
  "results": [
    {
      "localId": "local_001",
      "serverId": "uuid-new-123",
      "action": "create",
      "status": "success"
    },
    {
      "localId": "local_002",
      "serverId": "uuid-existing-456",
      "action": "update",
      "status": "conflict",
      "conflictData": {
        "clientData": {
          "title": "Senior Developer",
          "interests": ["technology", "programming", "AI"]
        },
        "serverData": {
          "title": "Lead Developer",
          "interests": ["technology", "leadership"]
        },
        "conflictFields": ["title", "interests"]
      }
    },
    {
      "localId": "local_003",
      "serverId": "uuid-to-delete-789",
      "action": "delete",
      "status": "success"
    }
  ],
  "conflicts": [
    {
      "localId": "local_002",
      "serverId": "uuid-existing-456",
      "conflictData": {
        "clientData": {
          "title": "Senior Developer",
          "interests": ["technology", "programming", "AI"]
        },
        "serverData": {
          "title": "Lead Developer",
          "interests": ["technology", "leadership"]
        },
        "conflictFields": ["title", "interests"]
      }
    }
  ],
  "errors": [],
  "syncTimestamp": "2023-12-01T11:20:00.000Z"
}
```

## Conflict Resolution Scenarios

### Scenario 1: Simple Field Conflict

**Situation**: User updates visitor's title offline while another user updates it online.

```javascript
// Client data (offline modification)
const clientData = {
  name: "John Smith",
  title: "Senior Manager",
  company: "Tech Corp",
  lastModified: "2023-12-01T10:30:00.000Z"
};

// Server data (online modification by another user)
const serverData = {
  name: "John Smith",
  title: "Director of Operations",
  company: "Tech Corp",
  lastModified: "2023-12-01T10:25:00.000Z"
};

// Conflict detected - same field modified
const conflict = {
  localId: "local_123",
  serverId: "uuid-456",
  conflictFields: ["title"],
  clientData: clientData,
  serverData: serverData
};
```

**Resolution Options**:

#### Option 1: Server Wins
```javascript
const resolution = {
  strategy: "server_wins",
  resolvedData: serverData
};

// Result: Title becomes "Director of Operations"
```

#### Option 2: Client Wins
```javascript
const resolution = {
  strategy: "client_wins",
  resolvedData: clientData
};

// Result: Title becomes "Senior Manager"
```

#### Option 3: Manual Resolution
```javascript
const resolution = {
  strategy: "manual",
  resolvedData: {
    ...serverData,
    title: "Senior Director", // User-chosen compromise
    notes: `Previous titles: ${clientData.title} (client), ${serverData.title} (server)`
  }
};
```

### Scenario 2: Array Merge Conflict

**Situation**: Interests array modified on both client and server.

```javascript
// Client adds new interests
const clientData = {
  interests: ["technology", "innovation", "AI", "blockchain"]
};

// Server adds different interests
const serverData = {
  interests: ["technology", "innovation", "leadership", "management"]
};

// Smart merge resolution
const resolution = {
  strategy: "merge",
  resolvedData: {
    interests: [
      ...new Set([
        ...clientData.interests,
        ...serverData.interests
      ])
    ]
    // Result: ["technology", "innovation", "AI", "blockchain", "leadership", "management"]
  }
};
```

### Scenario 3: Complex Multi-Field Conflict

```javascript
// Complex conflict with multiple fields
const conflict = {
  localId: "local_789",
  serverId: "uuid-101112",
  conflictFields: ["title", "phone", "interests", "notes"],
  clientData: {
    title: "VP Marketing",
    phone: "+1-555-0123",
    interests: ["marketing", "digital", "analytics"],
    notes: "Follow up on Q1 campaign discussion"
  },
  serverData: {
    title: "Chief Marketing Officer",
    phone: "+1-555-0124",
    interests: ["marketing", "strategy", "branding"],
    notes: "Interested in our new product line"
  }
};

// Field-by-field resolution
const resolution = {
  strategy: "manual",
  resolvedData: {
    title: "Chief Marketing Officer", // Server wins - more recent promotion
    phone: "+1-555-0123", // Client wins - user verified this number
    interests: ["marketing", "digital", "analytics", "strategy", "branding"], // Merge both
    notes: "Follow up on Q1 campaign discussion. Interested in our new product line" // Combine both
  }
};
```

## Advanced Sync Patterns

### 1. Incremental Sync with Timestamps

```javascript
// Client tracks last sync timestamp
const lastSyncTimestamp = await AsyncStorage.getItem('lastSyncTimestamp');

// Only sync changes since last sync
const pendingOperations = await DatabaseService.getPendingOperations(lastSyncTimestamp);

const syncRequest = {
  operations: pendingOperations,
  lastSyncTimestamp: lastSyncTimestamp
};

// Server returns only changes since timestamp
const response = await syncData(syncRequest);

// Update last sync timestamp
await AsyncStorage.setItem('lastSyncTimestamp', response.syncTimestamp);
```

### 2. Chunked Sync for Large Datasets

```javascript
class ChunkedSyncManager {
  async syncLargeDataset(operations, chunkSize = 50) {
    const chunks = this.createChunks(operations, chunkSize);
    const results = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const result = await this.syncChunk(chunk, i + 1, chunks.length);
        results.push(result);
        
        // Update progress
        this.updateProgress((i + 1) / chunks.length * 100);
        
        // Brief pause between chunks to avoid overwhelming server
        await this.delay(100);
        
      } catch (error) {
        console.error(`Chunk ${i + 1} failed:`, error);
        // Continue with next chunk
      }
    }
    
    return this.consolidateResults(results);
  }
  
  createChunks(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  async syncChunk(operations, chunkNumber, totalChunks) {
    const response = await fetch('/api/visitors/bulk-sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json',
        'X-Sync-Chunk': `${chunkNumber}/${totalChunks}`
      },
      body: JSON.stringify({
        operations: operations,
        chunkInfo: {
          number: chunkNumber,
          total: totalChunks
        }
      })
    });
    
    return await response.json();
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Conflict Resolution UI Components

```jsx
// React Native conflict resolution component
const ConflictResolutionModal = ({ conflict, onResolve, onCancel }) => {
  const [resolution, setResolution] = useState('server_wins');
  const [customData, setCustomData] = useState({});
  
  const handleResolve = () => {
    let resolvedData;
    
    switch (resolution) {
      case 'server_wins':
        resolvedData = conflict.serverData;
        break;
      case 'client_wins':
        resolvedData = conflict.clientData;
        break;
      case 'merge':
        resolvedData = mergeData(conflict.clientData, conflict.serverData);
        break;
      case 'manual':
        resolvedData = customData;
        break;
    }
    
    onResolve({
      localId: conflict.localId,
      strategy: resolution,
      resolvedData: resolvedData
    });
  };
  
  const mergeData = (client, server) => {
    const merged = { ...server, ...client };
    
    // Special handling for arrays
    if (client.interests && server.interests) {
      merged.interests = [...new Set([...client.interests, ...server.interests])];
    }
    
    // Combine notes
    if (client.notes && server.notes && client.notes !== server.notes) {
      merged.notes = `${client.notes}\n---\n${server.notes}`;
    }
    
    return merged;
  };
  
  return (
    <Modal visible={true} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>Data Conflict Detected</Text>
        <Text style={styles.subtitle}>
          The visitor "{conflict.clientData.name}" has been modified both locally and on the server.
        </Text>
        
        <View style={styles.conflictComparison}>
          <View style={styles.dataColumn}>
            <Text style={styles.columnTitle}>Your Changes</Text>
            {conflict.conflictFields.map(field => (
              <View key={field} style={styles.fieldRow}>
                <Text style={styles.fieldName}>{field}:</Text>
                <Text style={styles.fieldValue}>
                  {JSON.stringify(conflict.clientData[field])}
                </Text>
              </View>
            ))}
          </View>
          
          <View style={styles.dataColumn}>
            <Text style={styles.columnTitle}>Server Changes</Text>
            {conflict.conflictFields.map(field => (
              <View key={field} style={styles.fieldRow}>
                <Text style={styles.fieldName}>{field}:</Text>
                <Text style={styles.fieldValue}>
                  {JSON.stringify(conflict.serverData[field])}
                </Text>
              </View>
            ))}
          </View>
        </View>
        
        <View style={styles.resolutionOptions}>
          <TouchableOpacity
            style={[styles.option, resolution === 'server_wins' && styles.selectedOption]}
            onPress={() => setResolution('server_wins')}
          >
            <Text>Use Server Version</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.option, resolution === 'client_wins' && styles.selectedOption]}
            onPress={() => setResolution('client_wins')}
          >
            <Text>Use My Version</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.option, resolution === 'merge' && styles.selectedOption]}
            onPress={() => setResolution('merge')}
          >
            <Text>Merge Both</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resolveButton} onPress={handleResolve}>
            <Text style={styles.resolveText}>Resolve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
```

## Error Handling and Recovery

### 1. Partial Sync Failure Recovery

```javascript
class SyncRecoveryManager {
  async handlePartialSyncFailure(syncResult) {
    const { results, errors } = syncResult;
    
    // Separate successful and failed operations
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'error');
    
    // Update local database for successful operations
    for (const success of successful) {
      await DatabaseService.updateSyncStatus(
        success.localId,
        'synced',
        success.serverId
      );
    }
    
    // Retry failed operations with exponential backoff
    for (const failure of failed) {
      await this.scheduleRetry(failure);
    }
    
    // Handle conflicts separately
    if (syncResult.conflicts.length > 0) {
      await this.handleConflicts(syncResult.conflicts);
    }
  }
  
  async scheduleRetry(failedOperation, attempt = 1) {
    const maxAttempts = 5;
    const baseDelay = 1000; // 1 second
    
    if (attempt > maxAttempts) {
      // Mark as permanently failed
      await DatabaseService.updateSyncStatus(
        failedOperation.localId,
        'failed',
        null,
        'Max retry attempts exceeded'
      );
      return;
    }
    
    const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
    
    setTimeout(async () => {
      try {
        const result = await this.retrySingleOperation(failedOperation);
        if (result.success) {
          await DatabaseService.updateSyncStatus(
            failedOperation.localId,
            'synced',
            result.serverId
          );
        } else {
          await this.scheduleRetry(failedOperation, attempt + 1);
        }
      } catch (error) {
        await this.scheduleRetry(failedOperation, attempt + 1);
      }
    }, delay);
  }
}
```

### 2. Network Connectivity Handling

```javascript
class NetworkAwareSyncManager {
  constructor() {
    this.isOnline = true;
    this.pendingSync = false;
    
    // Monitor network status
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected;
      
      // Trigger sync when coming back online
      if (wasOffline && this.isOnline && !this.pendingSync) {
        this.triggerSync();
      }
    });
  }
  
  async syncWithNetworkHandling() {
    if (!this.isOnline) {
      console.log('Offline - sync will happen when connection is restored');
      return { success: false, reason: 'offline' };
    }
    
    if (this.pendingSync) {
      console.log('Sync already in progress');
      return { success: false, reason: 'in_progress' };
    }
    
    this.pendingSync = true;
    
    try {
      const result = await this.performSync();
      return result;
    } catch (error) {
      if (this.isNetworkError(error)) {
        console.log('Network error during sync - will retry when online');
        return { success: false, reason: 'network_error' };
      }
      throw error;
    } finally {
      this.pendingSync = false;
    }
  }
  
  isNetworkError(error) {
    return error.name === 'TypeError' || 
           error.message.includes('Network request failed') ||
           error.code === 'NETWORK_ERROR';
  }
}
```

## Performance Optimization

### 1. Efficient Data Serialization

```javascript
class OptimizedSyncSerializer {
  // Only send changed fields for updates
  serializeUpdateOperation(localData, serverData) {
    const changes = {};
    
    for (const [key, value] of Object.entries(localData)) {
      if (JSON.stringify(value) !== JSON.stringify(serverData[key])) {
        changes[key] = value;
      }
    }
    
    return {
      action: 'update',
      localId: localData.id,
      serverId: serverData.id,
      changes: changes, // Only changed fields
      timestamp: localData.updatedAt
    };
  }
  
  // Compress large sync payloads
  async compressSyncData(operations) {
    if (operations.length > 100) {
      // Use compression for large payloads
      const compressed = await this.compress(JSON.stringify(operations));
      return {
        compressed: true,
        data: compressed
      };
    }
    
    return {
      compressed: false,
      data: operations
    };
  }
}
```

### 2. Background Sync with Service Workers

```javascript
// Service worker for background sync (web apps)
self.addEventListener('sync', event => {
  if (event.tag === 'visitor-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

async function performBackgroundSync() {
  try {
    const pendingOperations = await getPendingOperations();
    if (pendingOperations.length > 0) {
      await syncToServer(pendingOperations);
    }
  } catch (error) {
    console.error('Background sync failed:', error);
    // Will retry on next sync event
  }
}

// Register background sync
if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
  navigator.serviceWorker.ready.then(registration => {
    return registration.sync.register('visitor-sync');
  });
}
```

## Testing Sync Operations

### 1. Unit Tests for Conflict Resolution

```javascript
describe('Conflict Resolution', () => {
  test('should resolve simple field conflict with server wins', () => {
    const conflict = {
      clientData: { title: 'Manager' },
      serverData: { title: 'Director' },
      conflictFields: ['title']
    };
    
    const resolver = new ConflictResolver();
    const result = resolver.resolve(conflict, 'server_wins');
    
    expect(result.title).toBe('Director');
  });
  
  test('should merge array fields correctly', () => {
    const conflict = {
      clientData: { interests: ['tech', 'AI'] },
      serverData: { interests: ['tech', 'leadership'] },
      conflictFields: ['interests']
    };
    
    const resolver = new ConflictResolver();
    const result = resolver.resolve(conflict, 'merge');
    
    expect(result.interests).toEqual(['tech', 'AI', 'leadership']);
  });
});
```

### 2. Integration Tests for Sync Flow

```javascript
describe('Sync Integration', () => {
  test('should handle complete sync flow with conflicts', async () => {
    // Setup: Create local visitor
    const localVisitor = await DatabaseService.createVisitor({
      name: 'Test User',
      company: 'Test Corp'
    });
    
    // Simulate server conflict
    mockApiResponse({
      results: [],
      conflicts: [{
        localId: localVisitor.id,
        conflictData: {
          clientData: { title: 'Manager' },
          serverData: { title: 'Director' }
        }
      }]
    });
    
    // Perform sync
    const syncManager = new SyncManager();
    const result = await syncManager.sync();
    
    // Verify conflict was detected
    expect(result.conflicts.length).toBe(1);
    
    // Resolve conflict
    await syncManager.resolveConflict(result.conflicts[0], 'server_wins');
    
    // Verify resolution
    const updatedVisitor = await DatabaseService.getVisitor(localVisitor.id);
    expect(updatedVisitor.title).toBe('Director');
  });
});
```

This comprehensive guide provides practical examples and patterns for implementing robust synchronization with conflict resolution in mobile applications.