import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc,
  serverTimestamp,
  Unsubscribe,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Todo, Note, Routine } from '../types';

// Sync data structure
export interface SyncData {
  todos: Todo[];
  routines: Routine[];
  notes: Note[];
  lastUpdated: Timestamp | null;
  deviceId: string;
}

// Sync state stored in localStorage
interface SyncState {
  syncCode: string | null;
  deviceId: string;
  enabled: boolean;
  lastSyncedAt: number | null;
}

const SYNC_STATE_KEY = 'northstar_sync_state';

// Generate a unique device ID
const generateDeviceId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Generate a human-readable sync code (e.g., "STAR-7X9K")
export const generateSyncCode = (): string => {
  const prefixes = ['STAR', 'NOVA', 'LUNA', 'ORION', 'NEBULA', 'COMET'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars like 0/O, 1/I
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${suffix}`;
};

// Get or create device ID
const getDeviceId = (): string => {
  const state = getSyncState();
  if (state.deviceId) return state.deviceId;
  
  const newId = generateDeviceId();
  saveSyncState({ ...state, deviceId: newId });
  return newId;
};

// Get sync state from localStorage
export const getSyncState = (): SyncState => {
  try {
    const saved = localStorage.getItem(SYNC_STATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load sync state:', e);
  }
  return {
    syncCode: null,
    deviceId: generateDeviceId(),
    enabled: false,
    lastSyncedAt: null
  };
};

// Save sync state to localStorage
const saveSyncState = (state: SyncState): void => {
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save sync state:', e);
  }
};

// Check if a sync room exists
export const checkSyncRoomExists = async (code: string): Promise<boolean> => {
  try {
    const docRef = doc(db, 'syncRooms', code.toUpperCase());
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (e) {
    console.error('Failed to check sync room:', e);
    return false;
  }
};

// Create a new sync room and upload initial data
export const createSyncRoom = async (
  code: string,
  data: { todos: Todo[]; routines: Routine[]; notes: Note[] }
): Promise<boolean> => {
  try {
    const deviceId = getDeviceId();
    const docRef = doc(db, 'syncRooms', code.toUpperCase());
    
    await setDoc(docRef, {
      todos: data.todos,
      routines: data.routines,
      notes: data.notes,
      lastUpdated: serverTimestamp(),
      deviceId: deviceId,
      createdAt: serverTimestamp()
    });
    
    // Save sync state
    saveSyncState({
      syncCode: code.toUpperCase(),
      deviceId,
      enabled: true,
      lastSyncedAt: Date.now()
    });
    
    return true;
  } catch (e) {
    console.error('Failed to create sync room:', e);
    return false;
  }
};

// Join an existing sync room
export const joinSyncRoom = async (code: string): Promise<SyncData | null> => {
  try {
    const normalizedCode = code.toUpperCase();
    const docRef = doc(db, 'syncRooms', normalizedCode);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = docSnap.data() as SyncData;
    const deviceId = getDeviceId();
    
    // Save sync state
    saveSyncState({
      syncCode: normalizedCode,
      deviceId,
      enabled: true,
      lastSyncedAt: Date.now()
    });
    
    return data;
  } catch (e) {
    console.error('Failed to join sync room:', e);
    return null;
  }
};

// Push changes to the sync room
export const pushChanges = async (
  data: { todos: Todo[]; routines: Routine[]; notes: Note[] }
): Promise<boolean> => {
  const state = getSyncState();
  
  if (!state.enabled || !state.syncCode) {
    return false;
  }
  
  try {
    const docRef = doc(db, 'syncRooms', state.syncCode);
    
    // Use setDoc with merge to create document if it doesn't exist
    // This handles cases where the document was deleted or never created
    await setDoc(docRef, {
      todos: data.todos,
      routines: data.routines,
      notes: data.notes,
      lastUpdated: serverTimestamp(),
      deviceId: state.deviceId
    }, { merge: true });
    
    // Update last synced time
    saveSyncState({
      ...state,
      lastSyncedAt: Date.now()
    });
    
    return true;
  } catch (e) {
    console.error('Failed to push changes:', e);
    return false;
  }
};

// Subscribe to real-time changes
export const subscribeToChanges = (
  onDataChange: (data: SyncData) => void,
  onError?: (error: Error) => void,
  onRoomMissing?: () => void
): Unsubscribe | null => {
  const state = getSyncState();
  
  if (!state.enabled || !state.syncCode) {
    return null;
  }
  
  try {
    const docRef = doc(db, 'syncRooms', state.syncCode);
    
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          // The room doc was deleted / doesn't exist yet.
          // Surface this to the caller so it can safely recreate the room.
          if (onRoomMissing) onRoomMissing();
          return;
        }

        const data = docSnap.data() as SyncData;
        
        // Only trigger callback if change came from another device
        // This prevents infinite loops when we push our own changes
        if (data.deviceId !== state.deviceId) {
          onDataChange(data);
          
          // Update last synced time
          saveSyncState({
            ...state,
            lastSyncedAt: Date.now()
          });
        }
      },
      (error) => {
        console.error('Sync subscription error:', error);
        if (onError) onError(error);
      }
    );
  } catch (e) {
    console.error('Failed to subscribe to changes:', e);
    return null;
  }
};

// Disconnect from sync (but keep the room)
export const disconnectSync = (): void => {
  const state = getSyncState();
  saveSyncState({
    ...state,
    enabled: false,
    syncCode: null
  });
};

// Get current sync code (if connected)
export const getCurrentSyncCode = (): string | null => {
  return getSyncState().syncCode;
};

// Check if sync is enabled
export const isSyncEnabled = (): boolean => {
  return getSyncState().enabled;
};

// Get last synced timestamp
export const getLastSyncedAt = (): number | null => {
  return getSyncState().lastSyncedAt;
};

// Helper function to merge arrays by ID, preferring newer items
const mergeByIdAndTimestamp = <T extends { id: string; createdAt?: number; resolvedAt?: number }>(
  localItems: T[],
  remoteItems: T[]
): T[] => {
  const merged = new Map<string, T>();
  
  // Add all remote items first
  remoteItems.forEach(item => merged.set(item.id, item));
  
  // Add or update with local items, preferring newer timestamps
  localItems.forEach(localItem => {
    const remoteItem = merged.get(localItem.id);
    
    if (!remoteItem) {
      // Item only exists locally, add it
      merged.set(localItem.id, localItem);
    } else {
      // Item exists in both, compare timestamps to determine which is newer
      const localTime = localItem.resolvedAt || localItem.createdAt || 0;
      const remoteTime = remoteItem.resolvedAt || remoteItem.createdAt || 0;
      
      // Keep the one with the newer timestamp
      if (localTime > remoteTime) {
        merged.set(localItem.id, localItem);
      }
      // If remote is newer or equal, it's already in the map
    }
  });
  
  return Array.from(merged.values());
};

// Force sync - smart sync that pulls, compares, and merges before deciding direction
export const forceSync = async (
  localData: { todos: Todo[]; routines: Routine[]; notes: Note[] }
): Promise<{ success: boolean; error?: string; remoteData?: SyncData }> => {
  const state = getSyncState();
  
  if (!state.enabled || !state.syncCode) {
    return { success: false, error: 'Sync not enabled' };
  }
  
  try {
    const docRef = doc(db, 'syncRooms', state.syncCode);
    
    // Step 1: Pull remote data first
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      // Room doesn't exist, create it with local data
      await setDoc(docRef, {
        todos: localData.todos,
        routines: localData.routines,
        notes: localData.notes,
        lastUpdated: serverTimestamp(),
        deviceId: state.deviceId
      });
      
      saveSyncState({
        ...state,
        lastSyncedAt: Date.now()
      });
      
      return { success: true };
    }
    
    const remoteData = docSnap.data() as SyncData;
    const remoteUpdatedAt = remoteData.lastUpdated?.toMillis?.() ?? 0;
    const localUpdatedAt = state.lastSyncedAt ?? 0;
    
    // Step 2: Compare timestamps and decide strategy
    const timeDiff = Math.abs(remoteUpdatedAt - localUpdatedAt);
    const CONFLICT_THRESHOLD = 5000; // 5 seconds
    
    if (timeDiff < CONFLICT_THRESHOLD) {
      // Step 3a: Timestamps are close - merge intelligently
      console.log('Force sync: Merging data from both sources');
      
      const mergedTodos = mergeByIdAndTimestamp(localData.todos, remoteData.todos || []);
      const mergedRoutines = mergeByIdAndTimestamp(localData.routines, remoteData.routines || []);
      const mergedNotes = mergeByIdAndTimestamp(localData.notes, remoteData.notes || []);
      
      // Push merged data back to Firebase
      await setDoc(docRef, {
        todos: mergedTodos,
        routines: mergedRoutines,
        notes: mergedNotes,
        lastUpdated: serverTimestamp(),
        deviceId: state.deviceId
      });
      
      saveSyncState({
        ...state,
        lastSyncedAt: Date.now()
      });
      
      // Return merged data to be applied locally
      return {
        success: true,
        remoteData: {
          todos: mergedTodos,
          routines: mergedRoutines,
          notes: mergedNotes,
          lastUpdated: remoteData.lastUpdated,
          deviceId: state.deviceId
        }
      };
    } else if (remoteUpdatedAt > localUpdatedAt) {
      // Step 3b: Remote is newer - pull remote data
      console.log('Force sync: Remote data is newer, pulling from server');
      
      saveSyncState({
        ...state,
        lastSyncedAt: Date.now()
      });
      
      // Return remote data to be applied locally
      return { success: true, remoteData };
    } else {
      // Step 3c: Local is newer - push local data
      console.log('Force sync: Local data is newer, pushing to server');
      
      await setDoc(docRef, {
        todos: localData.todos,
        routines: localData.routines,
        notes: localData.notes,
        lastUpdated: serverTimestamp(),
        deviceId: state.deviceId
      });
      
      saveSyncState({
        ...state,
        lastSyncedAt: Date.now()
      });
      
      return { success: true };
    }
  } catch (e) {
    console.error('Force sync failed:', e);
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
};
