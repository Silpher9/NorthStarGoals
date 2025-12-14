import React, { useState, useCallback, useRef } from 'react';
import StarryNight from './components/StarryNight';
import TodoList from './components/TodoList';
import VersionBadge from './components/VersionBadge';
import { Todo } from './types';

interface SyncState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastSyncedAt: number | null;
}

const App: React.FC = () => {
  const [goals, setGoals] = useState<Todo[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({ status: 'disconnected', lastSyncedAt: null });
  const forceSyncRef = useRef<(() => Promise<{ success: boolean; error?: string }>) | null>(null);

  const handleSyncStateChange = useCallback((state: SyncState) => {
    setSyncState(state);
  }, []);

  const handleForceSyncReady = useCallback((handler: () => Promise<{ success: boolean; error?: string }>) => {
    forceSyncRef.current = handler;
  }, []);

  const handleForceSync = useCallback(async () => {
    if (forceSyncRef.current) {
      return await forceSyncRef.current();
    }
    return { success: false, error: 'Sync not ready' };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Top 1/3: Visuals */}
      <div className="h-[33vh] w-full flex-shrink-0 z-10 shadow-2xl shadow-slate-900/50">
        <StarryNight 
          goals={goals} 
          syncState={syncState}
          onForceSync={handleForceSync}
        />
      </div>
      
      {/* Bottom 2/3: Functionality */}
      <div className="h-[67vh] w-full flex-grow z-0">
        <TodoList 
          onGoalsChange={setGoals}
          onSyncStateChange={handleSyncStateChange}
          onForceSyncReady={handleForceSyncReady}
        />
      </div>
      
      {/* Version Badge */}
      <VersionBadge />
    </div>
  );
};

export default App;