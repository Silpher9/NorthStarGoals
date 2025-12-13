import { Todo } from '../types';

// === CONSTANTS ===

export const TIER_MULTIPLIERS = {
  gold: 10,
  silver: 8,
  bronze: 6,
  normal: 5
} as const;

export type Tier = keyof typeof TIER_MULTIPLIERS;

export const TIER_COLORS = {
  gold: '#eab308',
  silver: '#cbd5e1',
  bronze: '#f97316',
  normal: '#a855f7'
} as const;

// === TIER CALCULATION ===

/**
 * Determines the tier of a todo by walking up the parent chain.
 * Returns the goalCategory of the first ancestor that is a goal, or 'normal' if none found.
 */
export function getTierFromTodo(todo: Todo, allTodos: Todo[]): Tier {
  let current: Todo | undefined = todo;

  while (current) {
    if (current.label === 'goal' && current.goalCategory) {
      return current.goalCategory as Tier;
    }
    if (current.parentId) {
      current = allTodos.find(t => t.id === current!.parentId);
    } else {
      break;
    }
  }
  return 'normal';
}

/**
 * Gets the tier multiplier value for a given tier.
 */
export function getTierMultiplier(tier: Tier): number {
  return TIER_MULTIPLIERS[tier];
}

// === POINT CALCULATION ===

/**
 * Calculates points for a single task (leaf node calculation).
 * Formula: quarterHours * tierMultiplier * velocityMultiplier
 * 
 * @param durationMinutes - Duration in minutes (defaults to 15 if not set)
 * @param tierMultiplier - Tier multiplier (5-10 based on gold/silver/bronze/normal)
 * @param velocityMultiplier - Velocity/streak multiplier (defaults to 1.0)
 */
export function calculateTaskPoints(
  durationMinutes: number | undefined,
  tierMultiplier: number,
  velocityMultiplier: number = 1.0
): number {
  const mins = durationMinutes || 15;
  const quarterHours = Math.ceil(mins / 15);
  return Math.round(quarterHours * tierMultiplier * velocityMultiplier);
}

/**
 * Calculates points for a todo using its tier (determined from parent chain).
 * This is the main function for calculating a single task's points.
 */
export function calculateTodoPoints(todo: Todo, allTodos: Todo[]): number {
  const tier = getTierFromTodo(todo, allTodos);
  const tierMultiplier = TIER_MULTIPLIERS[tier];
  const velocityMultiplier = todo.multiplier || 1.0;
  
  return calculateTaskPoints(todo.durationMinutes, tierMultiplier, velocityMultiplier);
}

/**
 * Recursively calculates the total base blocks (quarter hours * velocity) for a task and all its descendants.
 * This is used for aggregating points across a task tree.
 * 
 * @param todoId - The root todo ID to start calculation from
 * @param allTodos - All todos in the system
 * @returns Total base blocks (before tier multiplication)
 */
export function calculateTreeBaseBlocks(todoId: string, allTodos: Todo[]): number {
  const children = allTodos.filter(t => t.parentId === todoId && t.status !== 'graveyard');
  
  if (children.length > 0) {
    // Has children: recursively sum their blocks
    return children.reduce((sum, child) => sum + calculateTreeBaseBlocks(child.id, allTodos), 0);
  } else {
    // Leaf node: calculate blocks from duration
    const todo = allTodos.find(t => t.id === todoId);
    if (!todo) return 0;
    
    const mins = todo.durationMinutes || 15;
    const velocityMultiplier = todo.multiplier || 1.0;
    return Math.ceil(mins / 15) * velocityMultiplier;
  }
}

/**
 * Calculates the total points for a task tree (parent + all descendants).
 * Used for displaying aggregate points on parent tasks.
 */
export function calculateTreePoints(todoId: string, tierMultiplier: number, allTodos: Todo[]): number {
  const baseBlocks = calculateTreeBaseBlocks(todoId, allTodos);
  return Math.round(baseBlocks * tierMultiplier);
}

