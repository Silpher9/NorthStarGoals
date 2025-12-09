
export interface BuybackEvent {
  timestamp: number;
  cost: number;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  status: 'active' | 'graveyard' | 'archive';
  label: 'goal' | 'normal';
  goalCategory?: string;
  parentId?: string;
  description?: string;
  isActivated?: boolean;
  activationDeadline?: number; // Timestamp for daily expiration (Midnight)
  resolvedAt?: number; // Timestamp when completed or failed
  customLabel?: string;
  durationMinutes?: number; // Estimated duration in minutes
  buybackHistory?: BuybackEvent[];
  remainingTime?: number; // Milliseconds remaining (Snapshot)
  isPlaying?: boolean; // Is the timer currently ticking?
  lastStartedAt?: number; // Timestamp when timer was last started
}

export interface Note {
  id: string;
  text: string;
  createdAt: number;
  label?: string;
}
