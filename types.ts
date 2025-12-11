
export interface BuybackEvent {
  timestamp: number;
  cost: number;
}

export type Frequency = 'weekly' | 'biweekly' | 'monthly';

export interface Routine {
  id: string;
  title: string;
  label?: string;
  frequency: Frequency;
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  dayOfMonth?: number;  // 1-31
  targetCycles: number; // e.g. 4 weeks/cycles/months
  completedCycles: number; // Progress (Total completions)
  streak: number; // Current consecutive streak (Velocity)
  lastGeneratedDate?: string; // YYYY-MM-DD
  createdAt: number;
  color?: string;
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
  routineId?: string; // Link to the routine generator
  multiplier?: number; // Orbital Velocity Multiplier (1.0 - 1.5x)
}

export interface Note {
  id: string;
  text: string;
  createdAt: number;
  label?: string;
}