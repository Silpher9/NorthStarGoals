import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Todo } from '../types';
import { Trash2, Check, Clock, Trophy, FolderOpen, ChevronLeft, ChevronRight, ChevronDown, Plus, CornerDownRight, AlignLeft, Layers, Zap, Tag, Lock, Timer, RefreshCcw, Play, Pause, Archive, RotateCcw, X as XIcon, Edit3, Rocket, Eye, EyeOff, Flame, GripVertical, Copy } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { 
  TIER_MULTIPLIERS, 
  getTierFromTodo, 
  calculateTaskPoints, 
  calculateTreePoints,
  type Tier 
} from '../utils/pointCalculations';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  parentTier?: string;
  allTodos?: Todo[];
  labelOptions?: string[];
  onAddSubTask?: (parentId: string, text: string) => void;
  onUpdateDescription?: (id: string, description: string) => void;
  onUpdateText?: (id: string, text: string) => void;
  onUpdateLabel?: (id: string, label: string) => void;
  onActivate?: (id: string) => void;
  onSetDuration?: (id: string, durationMinutes: number) => void;
  onBuyback?: (id: string, cost: number) => void;
  onBreakDown?: (id: string) => Promise<void>;
  onToggleTimer?: (id: string) => void;
  onOpen?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  viewContext?: 'orbit' | 'today' | 'list';
  visibleIds?: Set<string>;
  isDraggable?: boolean;
  showNestZones?: boolean;
  draggedTaskId?: string | null;
}

const TodoItem: React.FC<TodoItemProps> = ({ 
  todo, 
  onToggle, 
  onDelete, 
  parentTier,
  allTodos,
  labelOptions,
  onAddSubTask,
  onUpdateDescription,
  onUpdateText,
  onUpdateLabel,
  onActivate,
  onSetDuration,
  onBuyback,
  onBreakDown,
  onToggleTimer,
  onOpen,
  onDuplicate,
  viewContext = 'list',
  visibleIds,
  isDraggable = false,
  showNestZones = false,
  draggedTaskId = null
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [subTaskInput, setSubTaskInput] = useState('');
  const [description, setDescription] = useState(todo.description || '');
  
  // Visual Clutter Toggle
  const [showDetails, setShowDetails] = useState(true);
  
  // Drag and drop functionality
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: todo.id,
    disabled: !isDraggable || todo.completed || todo.status === 'graveyard' || todo.status === 'archive',
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  // Nest zone droppable
  const { setNodeRef: setNestRef, isOver: isNestOver } = useDroppable({
    id: `nest-${todo.id}`,
    disabled: !showNestZones || draggedTaskId === todo.id || todo.completed || todo.status === 'graveyard' || todo.status === 'archive',
  });
  
  // Unnest zone droppable - show on PARENT of dragged task
  // Find if this todo is the parent of the currently dragged task
  const draggedTask = draggedTaskId && allTodos ? allTodos.find(t => t.id === draggedTaskId) : null;
  const isDraggedTaskParent = draggedTask?.parentId === todo.id;
  const { setNodeRef: setUnnestRef, isOver: isUnnestOver } = useDroppable({
    id: `unnest-${todo.id}`, // Use this todo's ID (the parent) - handler will find the dragged task
    disabled: !showNestZones || !isDraggedTaskParent,
  });
  
  // Activation / Duration Input State
  const [isActivating, setIsActivating] = useState(false);
  const [hoursInput, setHoursInput] = useState('0');
  const [minutesInput, setMinutesInput] = useState('15');

  // Confirmation Modal State
  const [showCompleteConfirmation, setShowCompleteConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Inline Editing State for Title and Label
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(todo.text);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editedLabel, setEditedLabel] = useState(todo.customLabel || '');
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
  const [labelMenuIndex, setLabelMenuIndex] = useState(0);
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  // Local Timer State for visual countdown
  const [timeLeftString, setTimeLeftString] = useState<string | null>(null);

  // Sync description state if prop changes
  useEffect(() => {
    setDescription(todo.description || '');
  }, [todo.description]);

  // Sync title/label state if prop changes
  useEffect(() => {
    setEditedTitle(todo.text);
  }, [todo.text]);

  useEffect(() => {
    setEditedLabel(todo.customLabel || '');
  }, [todo.customLabel]);

  const derivedLabelOptions = useMemo(() => {
    // If parent provided label options, trust that.
    if (labelOptions && labelOptions.length > 0) return labelOptions;
    if (!allTodos) return [];

    // Deduplicate case-insensitively but keep first-seen casing.
    const map = new Map<string, string>();
    for (const t of allTodos) {
      const raw = (t.customLabel || '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!map.has(key)) map.set(key, raw);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [allTodos, labelOptions]);

  const filteredLabelOptions = useMemo(() => {
    // If user hasn't started changing the label yet, show full list on open (so clicking a label reveals all).
    const current = (todo.customLabel || '').trim();
    if (isLabelMenuOpen && editedLabel.trim() === current) return derivedLabelOptions;

    const q = editedLabel.trim().toLowerCase();
    if (!q) return derivedLabelOptions;
    return derivedLabelOptions.filter(opt => opt.toLowerCase().includes(q));
  }, [derivedLabelOptions, editedLabel, isLabelMenuOpen, todo.customLabel]);

  // Keep highlight index valid as filter changes
  useEffect(() => {
    if (!isLabelMenuOpen) return;
    if (filteredLabelOptions.length === 0) {
      setLabelMenuIndex(0);
      return;
    }
    setLabelMenuIndex(prev => Math.max(0, Math.min(prev, filteredLabelOptions.length - 1)));
  }, [filteredLabelOptions.length, isLabelMenuOpen]);

  const isGraveyard = todo.status === 'graveyard';
  const isArchived = todo.status === 'archive';
  const isGoal = todo.label === 'goal';
  const tier = todo.goalCategory;
  
  // Treat as activated if explicitly set OR if we are in the 'today' view (implicit activation via parent)
  const isActivated = todo.isActivated === true || viewContext === 'today'; 
  const hasDuration = (todo.durationMinutes || 0) > 0;

  // Local Timer Logic: Calculate and update time left every second if playing
  useEffect(() => {
    const calculateTimeLeft = () => {
        if (isGraveyard || isArchived || todo.remainingTime === undefined) return null;
        
        let ms = todo.remainingTime;
        
        // If playing, subtract elapsed time since last start
        if (todo.isPlaying && todo.lastStartedAt) {
            const elapsed = Date.now() - todo.lastStartedAt;
            ms = Math.max(0, ms - elapsed);
        }

        const h = Math.floor(ms / (1000 * 60 * 60));
        const m = Math.floor((ms / (1000 * 60)) % 60);
        const s = Math.floor((ms / 1000) % 60);

        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    };

    // Initial calculation
    setTimeLeftString(calculateTimeLeft());

    let interval: ReturnType<typeof setInterval>;
    if (todo.isPlaying) {
        interval = setInterval(() => {
            setTimeLeftString(calculateTimeLeft());
        }, 1000);
    }

    return () => clearInterval(interval);
  }, [todo.remainingTime, todo.isPlaying, todo.lastStartedAt, isGraveyard, isArchived]);


  // Recursive Path Calculation
  const hierarchyPath = useMemo(() => {
      if (!allTodos) return '';
      const path: string[] = [];
      let current = allTodos.find(t => t.id === todo.parentId);
      while(current) {
          path.unshift(current.text);
          current = allTodos.find(t => t.id === current?.parentId);
      }
      return path.join(' / ');
  }, [allTodos, todo.parentId]);

  const subTasks = useMemo(() => {
      if (!allTodos) return [];
      return allTodos.filter(t => t.parentId === todo.id && t.status !== 'graveyard');
  }, [allTodos, todo.id]);

  const activeSubTasks = subTasks.filter(t => !t.completed);
  const completedSubTasks = subTasks.filter(t => t.completed);
  const hasSubTasks = subTasks.length > 0;
  
  const isBlocked = activeSubTasks.length > 0;

  const visibleSubTasks = useMemo(() => {
      if (!visibleIds) return subTasks;
      return subTasks.filter(t => visibleIds.has(t.id));
  }, [subTasks, visibleIds]);

  const activeVisibleSubTasks = visibleSubTasks.filter(t => !t.completed);
  const completedVisibleSubTasks = visibleSubTasks.filter(t => t.completed);

  useEffect(() => {
      if (viewContext === 'today' && activeVisibleSubTasks.length > 0) {
          setIsExpanded(true);
      }
  }, [viewContext, activeVisibleSubTasks.length]);

  const treeStats = useMemo(() => {
    if (!allTodos) return { count: 0, depth: 0 };
    
    let count = 0;
    let maxDepth = 0;

    const traverse = (pid: string, currentDepth: number) => {
        const children = allTodos.filter(t => t.parentId === pid && t.status !== 'graveyard' && !t.completed);
        
        if (children.length > 0) {
            const nextLevel = currentDepth + 1;
            maxDepth = Math.max(maxDepth, nextLevel);
            
            children.forEach(child => {
                count++;
                traverse(child.id, nextLevel);
            });
        }
    };

    traverse(todo.id, 0);
    return { count, depth: maxDepth };
  }, [allTodos, todo.id]);
  
  // Robust Tier Inheritance
  // Even if parentTier prop isn't passed (e.g. in Today view), we climb the tree to find the category.
  const effectiveTier = useMemo((): Tier => {
      if (tier) return tier as Tier; // If I am a goal/category
      if (parentTier) return parentTier as Tier; // If passed from parent render

      // Use shared utility to find tier from parent chain
      if (allTodos) {
          return getTierFromTodo(todo, allTodos);
      }
      return 'normal';
  }, [tier, parentTier, allTodos, todo]);

  const tierMultiplier = useMemo(() => {
    return TIER_MULTIPLIERS[effectiveTier];
  }, [effectiveTier]);

  const containerClasses = useMemo(() => {
    if (isArchived) {
        return 'bg-slate-800/20 border-slate-700/20 shadow-none opacity-60 grayscale hover:grayscale-0 transition-all';
    }

    if (isGraveyard) {
        return 'bg-red-500/10 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.05)]';
    }

    if (viewContext === 'today' && isBlocked) {
        return 'bg-transparent border-transparent opacity-90 pl-0 border-l border-slate-700/50 rounded-none border-l-2 ml-2'; 
    }

    if (todo.completed) {
        return 'bg-emerald-500/20 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]';
    }

    if (!isActivated) {
        return 'bg-slate-800/20 border-slate-700 border-dashed hover:border-slate-500/50';
    }

    // Apply Tier Styling
    switch (effectiveTier) {
        case 'gold': return 'bg-gradient-to-br from-yellow-900/20 to-slate-900/80 border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.05)]';
        case 'silver': return 'bg-gradient-to-br from-slate-400/10 to-slate-900/80 border-slate-300/40 shadow-[0_0_10px_rgba(203,213,225,0.05)]';
        case 'bronze': return 'bg-gradient-to-br from-orange-900/20 to-slate-900/80 border-orange-600/40 shadow-[0_0_10px_rgba(234,88,12,0.05)]';
        default: return 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/50';
    }
  }, [isGraveyard, isArchived, effectiveTier, todo.completed, isActivated, viewContext, isBlocked]);

  const iconColor = useMemo(() => {
     switch (effectiveTier) {
         case 'gold': return 'text-yellow-500';
         case 'silver': return 'text-cyan-100';
         case 'bronze': return 'text-orange-500';
         default: return 'text-purple-400';
     }
  }, [effectiveTier]);

  const formattedDuration = useMemo(() => {
      const mins = todo.durationMinutes || 0;
      if (mins === 0) return null;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
  }, [todo.durationMinutes]);

  // Aggregated Points Calculation (for Children) - uses shared utility
  const totalPoints = useMemo(() => {
      if (!allTodos) return 0;
      return calculateTreePoints(todo.id, tierMultiplier, allTodos);
  }, [allTodos, todo.id, tierMultiplier]);
  
  // Calculate potential earnings for this specific task - uses shared utility
  const taskEarnedPoints = useMemo(() => {
      return calculateTaskPoints(todo.durationMinutes, tierMultiplier, todo.multiplier);
  }, [todo.durationMinutes, tierMultiplier, todo.multiplier]);

  // Dynamic Buyback Cost: 1.5x earnings
  const buybackCost = useMemo(() => {
      return Math.ceil(taskEarnedPoints * 1.5);
  }, [taskEarnedPoints]);
  
  // Calculate preview points for the activation form
  const previewPoints = useMemo(() => {
      const h = parseInt(hoursInput || '0', 10);
      const m = parseInt(minutesInput || '0', 10);
      const totalMinutes = h * 60 + m;
      return calculateTaskPoints(totalMinutes || 15, tierMultiplier, todo.multiplier);
  }, [hoursInput, minutesInput, tierMultiplier, todo.multiplier]);

  const isContextParent = viewContext === 'today' && isBlocked;
  
  const showActionButton = !isContextParent && (
    isGraveyard || 
    isArchived || 
    (!todo.completed && (isActivated || viewContext === 'list') && viewContext !== 'orbit')
  );
  
  // Can we show the activation controls (Activate OR Edit Timer)?
  // Parents (with subtasks) should not have their own timer set, they are containers.
  const canSetTimer = !isContextParent && !isGraveyard && !isArchived && !todo.completed && !hasSubTasks;
  
  // Revised Buyback Logic: Explicitly check for Today view + active status (implicit or explicit)
  const showBuybackButton = onBuyback && (
    (viewContext === 'today' && !isBlocked && !todo.completed && !isGraveyard && !isArchived) ||
    (isGraveyard && !isArchived)
  );
  
  const canActivate = !isBlocked;

  // Visibility logic for the Timer Pill (Points display)
  // Show if: Has Subtasks (Aggregate) OR Duration is Set (even if not activated yet)
  const showTimerPill = !isGraveyard && !isArchived && !isContextParent && (
      hasSubTasks || hasDuration
  );

  const handleSubTaskSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (subTaskInput.trim() && onAddSubTask) {
          onAddSubTask(todo.id, subTaskInput.trim());
          setSubTaskInput('');
      }
  };

  const handleDescriptionBlur = () => {
      if (onUpdateDescription && description !== todo.description) {
          onUpdateDescription(todo.id, description);
      }
  };

  const handleTitleSave = () => {
      if (onUpdateText && editedTitle.trim() && editedTitle !== todo.text) {
          onUpdateText(todo.id, editedTitle.trim());
      }
      setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          handleTitleSave();
      } else if (e.key === 'Escape') {
          setEditedTitle(todo.text);
          setIsEditingTitle(false);
      }
  };

  const handleLabelSave = () => {
      if (onUpdateLabel && editedLabel !== (todo.customLabel || '')) {
          onUpdateLabel(todo.id, editedLabel.trim());
      }
      setIsEditingLabel(false);
      setIsLabelMenuOpen(false);
  };

  const commitLabelOption = useCallback((value: string) => {
    if (onUpdateLabel) onUpdateLabel(todo.id, value.trim());
    setEditedLabel(value);
    setIsEditingLabel(false);
    setIsLabelMenuOpen(false);
  }, [onUpdateLabel, todo.id]);

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsLabelMenuOpen(true);
      if (filteredLabelOptions.length > 0) {
        setLabelMenuIndex(i => Math.min(i + 1, filteredLabelOptions.length - 1));
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsLabelMenuOpen(true);
      if (filteredLabelOptions.length > 0) {
        setLabelMenuIndex(i => Math.max(i - 1, 0));
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isLabelMenuOpen && filteredLabelOptions[labelMenuIndex]) {
        commitLabelOption(filteredLabelOptions[labelMenuIndex]);
      } else {
        handleLabelSave();
      }
      return;
    }
    if (e.key === 'Escape') {
      if (isLabelMenuOpen) {
        e.preventDefault();
        setIsLabelMenuOpen(false);
        return;
      }
      setEditedLabel(todo.customLabel || '');
      setIsEditingLabel(false);
      setIsLabelMenuOpen(false);
    }
  };

  const handleSetTimerClick = () => {
      if (canActivate && canSetTimer) {
          // Pre-fill with existing if any
          const mins = todo.durationMinutes || 15;
          setHoursInput(Math.floor(mins / 60).toString());
          setMinutesInput((mins % 60).toString());
          setIsActivating(true);
      }
  };
  
  const handleBuybackClick = () => {
      if (onBuyback) {
          onBuyback(todo.id, buybackCost);
      }
  };

  const confirmSetDuration = (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onSetDuration) return;

      const h = parseInt(hoursInput || '0', 10);
      const m = parseInt(minutesInput || '0', 10);
      const totalMinutes = h * 60 + m;

      onSetDuration(todo.id, totalMinutes);
      setIsActivating(false);
  };

  const handleActivate = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onActivate) {
          // Removed confirmation check for totalPlannedTime to allow multiple active tasks
          onActivate(todo.id);
      }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('default', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
  };

  // Note: Visibility filtering is handled by the parent component via `visibleSubTasks`
  // (see lines 158-161). No need to check `visibleIds` here.

  return (
    <div className={`mb-3 transition-all duration-300`}>
        {showCompleteConfirmation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/95 md:bg-black/70 md:backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); setShowCompleteConfirmation(false); }}>
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-6 shadow-2xl max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <Check size={20} className="text-emerald-400" />
                        Confirm Completion
                    </h3>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                        Are you sure you want to mark <span className="text-white font-bold">"{todo.text}"</span> as complete?
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setShowCompleteConfirmation(false)}
                            className="px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold uppercase tracking-wider min-h-[44px]"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                onToggle(todo.id);
                                setShowCompleteConfirmation(false);
                            }}
                            className="px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 text-xs font-bold uppercase tracking-wider min-h-[44px]"
                        >
                            Complete Task
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showDeleteConfirmation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/95 md:bg-black/70 md:backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirmation(false); }}>
                <div className="bg-slate-900 border border-red-500/30 rounded-xl p-6 shadow-2xl max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <Trash2 size={20} className="text-red-400" />
                        Confirm Delete
                    </h3>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                        Are you sure you want to delete <span className="text-white font-bold">"{todo.text}"</span> and all its subtasks?
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setShowDeleteConfirmation(false)}
                            className="px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold uppercase tracking-wider min-h-[44px]"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                onDelete(todo.id);
                                setShowDeleteConfirmation(false);
                            }}
                            className="px-4 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 text-xs font-bold uppercase tracking-wider min-h-[44px]"
                        >
                            Delete Task
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div 
        ref={setNodeRef}
        style={style}
        className={`
            group flex items-center gap-3 p-4 rounded-xl border relative
            ${containerClasses}
            ${isDragging ? 'scale-95 shadow-2xl z-50' : ''}
        `}
        >
        {/* Drag Handle */}
        {isDraggable && !isContextParent && (
            <div
                {...attributes}
                {...listeners}
                className="flex-shrink-0 cursor-grab active:cursor-grabbing text-slate-600 hover:text-indigo-400 transition-colors p-1 -ml-2"
                title="Drag to reorder • Drop on yellow zone to nest • Drop on purple zone to unnest"
            >
                <GripVertical size={18} />
            </div>
        )}
        
        {!isGraveyard && !isArchived && (hasSubTasks || todo.description) && (
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`
                    absolute left-[-18px] top-1/2 -translate-y-1/2 
                    p-3 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/50 transition-all z-10
                    ${(hasSubTasks || todo.description) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                `}
                title={isExpanded ? "Collapse" : "Show details & subtasks"}
            >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
        )}

        {isContextParent && (
            <div className="flex-shrink-0 w-6 flex justify-center">
                <FolderOpen size={14} className="text-slate-600" />
            </div>
        )}

        <div 
            className="flex-grow flex flex-col justify-center min-w-0 cursor-pointer" 
            onClick={() => !isGraveyard && !isArchived && setIsExpanded(!isExpanded)} 
        >
            {/* ENHANCED ORIGIN DISPLAY FOR TODAY VIEW */}
            {/* Always visible in Today view or when Details are HIDDEN to provide context in minimal mode */}
            {(viewContext === 'today' || !showDetails) && hierarchyPath && !isContextParent && (
                <div className="text-[10px] text-indigo-300/80 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 p-1 bg-slate-900/40 rounded w-fit border border-indigo-500/20">
                     <FolderOpen size={10} className="text-indigo-400" />
                     <span className="opacity-90">{hierarchyPath}</span>
                </div>
            )}
            
            <div className="flex flex-wrap items-center gap-2">
                {/* Visual clutter toggled by eye icon */}
                {showDetails && (
                    <>
                        {isGoal && !isGraveyard && !isArchived && !todo.completed && <Trophy size={14} className={`${iconColor} animate-pulse flex-shrink-0`} />}
                        {isArchived && <Archive size={14} className="text-slate-500 flex-shrink-0" />}
                        
                        {/* EXPLICIT MULTIPLIER BADGE */}
                        {!isArchived && !isGraveyard && (
                            <span 
                                className={`
                                    text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded border flex items-center gap-1
                                    ${effectiveTier === 'gold' ? 'bg-yellow-900/30 border-yellow-500/50 text-yellow-500' :
                                    effectiveTier === 'silver' ? 'bg-slate-700/30 border-slate-300/50 text-slate-300' :
                                    effectiveTier === 'bronze' ? 'bg-orange-900/30 border-orange-500/50 text-orange-500' :
                                    'bg-purple-900/30 border-purple-500/50 text-purple-400'}
                                `}
                                title={`Multiplier: ${tierMultiplier}x Points`}
                            >
                                <Zap size={8} className="fill-current" />
                                {tierMultiplier}x
                            </span>
                        )}

                        {/* VELOCITY BONUS BADGE */}
                        {!isArchived && !isGraveyard && todo.multiplier && todo.multiplier > 1.0 && (
                            <span 
                                className="text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded border flex items-center gap-1 bg-cyan-900/30 border-cyan-400/50 text-cyan-400"
                                title={`Velocity Bonus: ${todo.multiplier}x`}
                            >
                                <Flame size={8} className="fill-current" />
                                +{Math.round((todo.multiplier - 1) * 100)}%
                            </span>
                        )}

                        {!isGraveyard && !isArchived && (
                            isEditingLabel ? (
                                <div className="relative flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <Tag size={8} className="text-indigo-400" />
                                    <input
                                        ref={labelInputRef}
                                        type="text"
                                        value={editedLabel}
                                        onChange={(e) => { setEditedLabel(e.target.value); setIsLabelMenuOpen(true); }}
                                        onFocus={() => { setIsLabelMenuOpen(true); }}
                                        onBlur={() => { handleLabelSave(); }}
                                        onKeyDown={handleLabelKeyDown}
                                        className="bg-slate-900 border border-indigo-500/50 rounded px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider text-indigo-300 focus:outline-none focus:border-indigo-400 w-24"
                                        placeholder="Label"
                                        autoFocus
                                        aria-label="Task label"
                                        aria-expanded={isLabelMenuOpen}
                                        aria-autocomplete="list"
                                    />

                                    {isLabelMenuOpen && filteredLabelOptions.length > 0 && (
                                      <div
                                        className="absolute left-0 top-full mt-1 w-44 max-h-40 overflow-auto rounded-lg border border-slate-700/70 bg-slate-950/95 backdrop-blur shadow-2xl z-50"
                                        onMouseDown={(e) => e.preventDefault()}
                                      >
                                        {filteredLabelOptions.slice(0, 20).map((opt, idx) => (
                                          <button
                                            key={opt}
                                            type="button"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              commitLabelOption(opt);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-[10px] uppercase font-bold tracking-wider transition-colors ${
                                              idx === labelMenuIndex
                                                ? 'bg-indigo-600/30 text-indigo-200'
                                                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                                            }`}
                                          >
                                            {opt}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                </div>
                            ) : todo.customLabel && onUpdateLabel ? (
                                <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      setIsEditingLabel(true); 
                                      setIsLabelMenuOpen(true);
                                      setLabelMenuIndex(0);
                                      // Ensure input focuses after state change
                                      setTimeout(() => labelInputRef.current?.focus(), 0);
                                    }}
                                    className="flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                                    title="Click to edit label"
                                >
                                    <Tag size={8} />
                                    {todo.customLabel}
                                </button>
                            ) : todo.customLabel ? (
                                <span className="flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                                    <Tag size={8} />
                                    {todo.customLabel}
                                </span>
                            ) : onUpdateLabel && (
                                <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      setIsEditingLabel(true); 
                                      setIsLabelMenuOpen(true);
                                      setLabelMenuIndex(0);
                                      setTimeout(() => labelInputRef.current?.focus(), 0);
                                    }}
                                    className="flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-dashed border-slate-600 bg-slate-800/30 text-slate-500 hover:border-indigo-500/50 hover:text-indigo-400 transition-colors"
                                    title="Add label"
                                >
                                    <Tag size={8} />
                                    <Plus size={8} />
                                </button>
                            )
                        )}
                        
                        {showTimerPill && (
                            <div
                                className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all ${
                                    (!hasSubTasks && isActivated)
                                        ? 'text-emerald-400 bg-emerald-900/20 border-emerald-500/20' 
                                        : 'text-slate-500 bg-slate-800/20 border-slate-700/20 opacity-70'
                                }`}
                                title={(!hasSubTasks && isActivated) ? "Points Value" : "Points aggregated from subtasks"}
                            >
                                <Timer size={8} />
                                {(!hasSubTasks && (hasDuration || isActivated)) ? (formattedDuration || '15m') : 'Sum'} 
                                <span className="opacity-50 mx-1">|</span>
                                <span>{totalPoints} pts</span>
                            </div>
                        )}
                    </>
                )}
                
                {/* REMOVED Individual Daily Deadline Countdown - Moved to Global Header */}

                {isEditingTitle ? (
                    <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onBlur={handleTitleSave}
                        onKeyDown={handleTitleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className={`
                            text-sm md:text-base bg-slate-900 border border-indigo-500/50 rounded px-2 py-1
                            focus:outline-none focus:border-indigo-400 flex-grow min-w-[200px]
                            ${isGoal ? 'text-slate-100 font-medium' : 'text-slate-200'}
                        `}
                        autoFocus
                    />
                ) : (
                    <span 
                        onClick={(e) => { 
                            if (onUpdateText && !isGraveyard && !isArchived && !todo.completed) {
                                e.stopPropagation(); 
                                setIsEditingTitle(true); 
                            }
                        }}
                        className={`
                            text-sm md:text-base break-words transition-all truncate
                            ${isGraveyard ? 'text-red-300/60 line-through decoration-red-500/30' : 
                              isArchived ? 'text-slate-500 italic' :
                              todo.completed ? 'text-slate-500 line-through decoration-slate-600' : 
                              isGoal ? 'text-slate-100 font-medium' : 
                              isActivated ? 'text-slate-200' : 'text-slate-400 italic'}
                            ${isContextParent ? 'text-slate-500 font-bold uppercase text-xs tracking-wider' : ''}
                            ${onUpdateText && !isGraveyard && !isArchived && !todo.completed ? 'cursor-text hover:bg-slate-800/50 rounded px-1 -mx-1' : ''}
                        `}
                        title={onUpdateText && !isGraveyard && !isArchived && !todo.completed ? "Click to edit title" : undefined}
                    >
                        {todo.text}
                    </span>
                )}
                
                {showDetails && isBlocked && !isContextParent && !todo.completed && !isArchived && (
                    <span title="Complete subtasks first" className="flex items-center">
                        <Lock size={12} className="text-slate-600" />
                    </span>
                )}

                {showDetails && todo.description && !isExpanded && !isArchived && (
                     <AlignLeft size={12} className={todo.description ? "text-indigo-400" : "text-slate-500"} />
                )}

                {showDetails && treeStats.count > 0 && !isExpanded && !isContextParent && !isArchived && (
                     <div className="flex items-center gap-1.5 ml-1.5 px-2 py-0.5 bg-slate-800/80 border border-slate-700/50 rounded-md text-[10px] text-slate-400 font-mono shadow-sm">
                        <div className="flex items-center gap-1">
                            <CornerDownRight size={10} />
                            <span className="font-bold text-slate-300">{treeStats.count}</span>
                        </div>
                        {treeStats.depth > 1 && (
                            <div className="flex items-center gap-1 pl-1.5 border-l border-slate-700/50">
                                <Layers size={10} />
                                <span>{treeStats.depth}</span>
                            </div>
                        )}
                     </div>
                )}
            </div>
            
            {!isContextParent && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    {/* Timer Display/Button - Always keep active timer visible */}
                    {!isGraveyard && !isArchived && !todo.completed && isActivated && timeLeftString && (
                        <div className="flex items-center gap-1 mr-2">
                             <button
                                onClick={(e) => { e.stopPropagation(); onToggleTimer && onToggleTimer(todo.id); }}
                                className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-l border-y border-l transition-all min-h-[32px]
                                    ${todo.isPlaying 
                                        ? 'bg-orange-900/20 border-orange-500/30 text-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.1)]' 
                                        : 'bg-slate-800/50 border-slate-700 text-slate-500'
                                    }
                                `}
                            >
                                {todo.isPlaying ? <Pause size={10} className="fill-current" /> : <Play size={10} className="fill-current" />}
                                <span className={todo.isPlaying ? 'font-bold' : ''}>{timeLeftString}</span>
                            </button>
                            {/* Reset/Edit Timer Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleSetTimerClick(); }}
                                className="px-3 py-1.5 rounded-r border-y border-r border-slate-700 bg-slate-800/30 hover:bg-slate-700/50 text-slate-500 hover:text-white transition-colors min-h-[32px]"
                                title="Reset/Edit Timer"
                            >
                                <RotateCcw size={10} />
                            </button>
                        </div>
                    )}
                    
                    {showDetails && (
                        <>
                            <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500/80" title="Created At">
                                <span className="font-bold">Created:</span>
                                <span>{formatDate(todo.createdAt)}</span>
                            </div>

                            {todo.resolvedAt && (
                            <div 
                                    className={`flex items-center gap-1 text-[9px] font-mono ${isGraveyard ? 'text-red-400/70' : 'text-emerald-400/70'}`}
                                    title={isGraveyard ? "Failed At" : "Completed At"}
                                >
                                <span className="font-bold">{isGraveyard ? 'Failed:' : 'Done:'}</span>
                                <span>{formatDate(todo.resolvedAt)}</span>
                            </div>
                            )}
                        </>
                    )}
                </div>
            )}

        </div>

        {/* Nest/Unnest Drop Zones */}
        {showNestZones && draggedTaskId !== todo.id && !todo.completed && !isGraveyard && !isArchived && (
            <div
                ref={setNestRef}
                className={`
                    flex-shrink-0 px-3 py-2 rounded-lg border-2 transition-all cursor-pointer
                    ${isNestOver 
                        ? 'bg-yellow-500/20 border-yellow-500 scale-105' 
                        : 'bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10'
                    }
                `}
                title="Drop here to nest task inside"
            >
                <div className="flex items-center gap-1.5">
                    <Layers size={14} className="text-yellow-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-500">
                        Nest
                    </span>
                </div>
            </div>
        )}
        
        {showNestZones && isDraggedTaskParent && (
            <div
                ref={setUnnestRef}
                className={`
                    flex-shrink-0 px-3 py-2 rounded-lg border-2 transition-all cursor-pointer
                    ${isUnnestOver 
                        ? 'bg-purple-500/20 border-purple-500 scale-105' 
                        : 'bg-purple-500/5 border-purple-500/30 hover:bg-purple-500/10'
                    }
                `}
                title="Drop here to unnest (promote) task"
            >
                <div className="flex items-center gap-1.5">
                    <ChevronLeft size={14} className="text-purple-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">
                        Unnest
                    </span>
                </div>
            </div>
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
            {/* Clutter Toggle Eye */}
            {!isContextParent && !isGraveyard && !isArchived && (
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
                    className="p-3 rounded-lg text-slate-600 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                    title={showDetails ? "Hide details" : "Show details"}
                >
                    {showDetails ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
            )}

            {/* Activate/Timer Control Area */}
            {canSetTimer && onSetDuration && (
                isActivating ? (
                    <form 
                        onSubmit={confirmSetDuration} 
                        onClick={e => e.stopPropagation()} 
                        className="flex flex-col md:flex-row items-center bg-slate-800 rounded-lg border border-yellow-500/50 p-2 gap-2 shadow-lg z-10 my-2 ml-4"
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-yellow-500" />
                            <div className="flex items-center bg-slate-900 rounded-md border border-slate-600 gap-1 px-1 py-0.5">
                                <div className="flex items-center gap-0.5">
                                    <input 
                                        type="text" 
                                        value={hoursInput} 
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                                            setHoursInput(val);
                                        }}
                                        className="bg-transparent text-white text-base w-8 text-right focus:outline-none placeholder-slate-600 font-mono font-bold"
                                        placeholder="00"
                                    />
                                    <span className="text-[10px] text-slate-500 font-mono pt-1">h</span>
                                </div>
                                <span className="text-slate-600">:</span>
                                <div className="flex items-center gap-0.5">
                                    <input 
                                        type="text" 
                                        value={minutesInput} 
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                                            setMinutesInput(val);
                                        }}
                                        className="bg-transparent text-white text-base w-8 text-right focus:outline-none placeholder-slate-600 font-mono font-bold"
                                        placeholder="15"
                                        autoFocus
                                    />
                                    <span className="text-[10px] text-slate-500 font-mono pt-1">m</span>
                                </div>
                            </div>
                        </div>

                        {/* Live Point Preview */}
                        <div className="flex items-center gap-1.5 px-2 border-l border-slate-700 pl-3">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-yellow-500">{previewPoints} pts</span>
                                <span className="text-[9px] text-slate-400 font-mono leading-none">
                                    {Math.ceil((parseInt(hoursInput||'0')*60 + parseInt(minutesInput||'0'))/15)} blk x {tierMultiplier}x {(todo.multiplier && todo.multiplier > 1) ? `(+${Math.round((todo.multiplier - 1)*100)}%)` : ''}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 ml-1">
                            <button type="submit" className="p-3 hover:bg-emerald-900/30 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" title="Set Time">
                                <Check size={16} />
                            </button>
                             <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); setIsActivating(false); }}
                                className="p-3 hover:bg-slate-700 rounded text-slate-500"
                             >
                                <XIcon size={16} />
                            </button>
                        </div>
                    </form>
                ) : (
                    // ORBIT VIEW CONTROLS (for tasks WITHOUT subtasks - parent tasks with subtasks have their own controls below)
                    !isActivated && viewContext === 'orbit' && !hasSubTasks && (
                        hasDuration ? (
                            // DURATION IS SET -> SHOW ACTIVATE BUTTON
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleActivate}
                                    disabled={!canActivate}
                                    className={`
                                        p-3 rounded-lg transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)] flex items-center gap-2 group/activate
                                        ${canActivate 
                                            ? 'text-emerald-400 hover:text-white hover:bg-emerald-600/20 bg-emerald-500/10 border border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                                            : 'text-slate-600 bg-slate-800/50 border border-slate-700 opacity-50 cursor-not-allowed'
                                        }
                                    `}
                                    title="Launch Task (Move to Today)"
                                >
                                    <span className="text-xs font-bold uppercase tracking-wider opacity-80 group-hover/activate:opacity-100 hidden sm:inline whitespace-nowrap">Activate</span>
                                    {canActivate ? <Rocket size={16} className="fill-current" /> : <Lock size={14} />}
                                </button>
                                
                                {/* Edit Timer Button */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleSetTimerClick(); }}
                                    className="p-3 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                                    title="Edit Timer"
                                >
                                    <Edit3 size={14} />
                                </button>

                                {/* Duplicate Task Button */}
                                {onDuplicate && (
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            onDuplicate(todo.id);
                                        }}
                                        className="p-3 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-900/30 transition-colors"
                                        title="Duplicate Task"
                                    >
                                        <Copy size={14} />
                                    </button>
                                )}

                                {/* Delete Task Button */}
                                <button 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setShowDeleteConfirmation(true);
                                    }}
                                    className="p-3 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                                    title="Delete Task"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ) : (
                            // DURATION NOT SET -> SHOW SET TIMER BUTTON
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleSetTimerClick(); }}
                                    disabled={!canActivate}
                                    className={`
                                        p-3 rounded-lg transition-all shadow-[0_0_10px_rgba(234,179,8,0.1)] flex items-center gap-2 group/activate
                                        ${canActivate 
                                            ? 'text-yellow-500 hover:text-white hover:bg-yellow-600/20 bg-yellow-500/10 border border-yellow-500/30 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
                                            : 'text-slate-600 bg-slate-800/50 border border-slate-700 opacity-50 cursor-not-allowed'
                                        }
                                    `}
                                    title={canActivate ? "Set Timer" : "Finish nested tasks first"}
                                >
                                    <span className="text-xs font-bold uppercase tracking-wider opacity-80 group-hover/activate:opacity-100 hidden sm:inline whitespace-nowrap">Set Timer</span>
                                    {canActivate ? <Zap size={16} className="fill-current" /> : <Lock size={14} />}
                                </button>

                                {/* Duplicate Task Button */}
                                {onDuplicate && (
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            onDuplicate(todo.id);
                                        }}
                                        className="p-3 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-900/30 transition-colors"
                                        title="Duplicate Task"
                                    >
                                        <Copy size={14} />
                                    </button>
                                )}

                                {/* Delete Task Button */}
                                <button 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setShowDeleteConfirmation(true);
                                    }}
                                    className="p-3 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                                    title="Delete Task"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )
                    )
                )
            )}

            {/* Duplicate and Delete buttons for parent tasks (with subtasks) in Orbit view */}
            {!isActivated && viewContext === 'orbit' && hasSubTasks && !isGraveyard && !isArchived && !todo.completed && (
                <>
                    {onDuplicate && (
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                onDuplicate(todo.id);
                            }}
                            className="p-3 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-900/30 transition-colors"
                            title="Duplicate Task"
                        >
                            <Copy size={14} />
                        </button>
                    )}
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setShowDeleteConfirmation(true);
                        }}
                        className="p-3 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                        title="Delete Task"
                    >
                        <Trash2 size={14} />
                    </button>
                </>
            )}
            
            {showBuybackButton && showDetails && (
                <button
                    onClick={(e) => { e.stopPropagation(); handleBuybackClick(); }}
                    className="flex flex-col items-center justify-center px-4 py-3 rounded-lg border border-orange-500/30 bg-orange-900/10 hover:bg-orange-900/20 text-orange-400 transition-all mr-1"
                    title={`Buyback task for ${buybackCost} pts (${taskEarnedPoints}pts * 1.5)`}
                >
                    <div className="flex items-center gap-1">
                        <RefreshCcw size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Buyback</span>
                    </div>
                    <span className="text-[9px] font-mono opacity-80">-{buybackCost} pts</span>
                </button>
            )}

            {onOpen && !isContextParent && showDetails && (
                <button
                    onClick={(e) => { e.stopPropagation(); onOpen(todo.id); }}
                    className="p-3 rounded-lg text-indigo-400 hover:text-white hover:bg-indigo-900/20 transition-all"
                    title="Open Project View"
                >
                    <FolderOpen size={16} />
                </button>
            )}

            {showActionButton && (
                <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (isBlocked) return;
                    if (isGraveyard) {
                        onDelete(todo.id);
                    } else {
                        // In Today view, ask for confirmation via modal before completing an active task
                        if (viewContext === 'today' && !todo.completed) {
                            setShowCompleteConfirmation(true);
                        } else {
                            onToggle(todo.id);
                        }
                    }
                }}
                disabled={isBlocked}
                className={`
                    transition-all flex items-center gap-2 group/btn min-h-[44px]
                    ${isGraveyard 
                        ? 'p-3 rounded-lg text-red-900 hover:text-red-500 hover:bg-red-900/20' 
                        : isArchived
                            ? 'p-3 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800'
                            : isBlocked
                                ? 'px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                                : 'px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-white font-medium text-xs uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                    }
                `}
                title={
                    isGraveyard ? "Delete permanently" : 
                    isArchived ? "Restore from Archive" :
                    isBlocked ? "Complete subtasks first" :
                    "Mark as Done"
                }
                >
                {isGraveyard ? <Trash2 size={18} /> : 
                 isArchived ? <RefreshCcw size={18} /> : (
                    <>
                        <span className="hidden sm:inline">Complete</span>
                        {isBlocked ? <Lock size={14} /> : <Check size={16} className="group-hover/btn:scale-110 transition-transform" />}
                    </>
                )}
                </button>
            )}
        </div>
        </div>

        {isExpanded && !isGraveyard && !isArchived && (
            <div className={`
                mt-2 space-y-2 relative 
                ${isContextParent ? 'pl-4' : 'pl-6 md:pl-8 border-l border-slate-800 ml-4 md:ml-6'}
            `}>
                
                {(onUpdateDescription || (description && description.trim().length > 0)) && !isContextParent && (
                    <div className="mb-3 pr-1">
                        <button
                            onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                            className={`
                                w-full flex items-center gap-2 p-3 rounded-lg border border-transparent
                                transition-all duration-200 group/notes
                                ${isNotesExpanded 
                                    ? 'bg-slate-800/80 border-slate-700/50 text-indigo-200' 
                                    : 'bg-slate-800/30 hover:bg-slate-800/50 text-slate-500 hover:text-slate-300'
                                }
                            `}
                        >
                            <AlignLeft size={14} className={description ? 'text-indigo-400' : 'opacity-70'} />
                            <span className="text-xs font-bold uppercase tracking-wider flex-grow text-left flex items-center gap-2">
                                Extra Notes
                                {description && !isNotesExpanded && (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                )}
                            </span>
                            <ChevronDown 
                                size={14} 
                                className={`transition-transform duration-300 ${isNotesExpanded ? 'rotate-180' : ''}`} 
                            />
                        </button>

                        <div className={`
                            overflow-hidden transition-all duration-300 ease-in-out origin-top
                            ${isNotesExpanded ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'}
                        `}>
                            {onUpdateDescription ? (
                                <RichTextEditor
                                    value={description}
                                    onChange={setDescription}
                                    onBlur={handleDescriptionBlur}
                                    placeholder="Add a description, thoughts, or context..."
                                    minHeight="100px"
                                />
                            ) : (
                                <div 
                                    className="p-3 text-sm text-slate-400 bg-slate-900/30 rounded-lg border border-slate-800 whitespace-pre-wrap [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5"
                                    dangerouslySetInnerHTML={{ __html: description }}
                                />
                            )}
                        </div>
                    </div>
                )}

                <SortableContext items={activeVisibleSubTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {activeVisibleSubTasks.map(subTodo => (
                        <TodoItem
                            key={subTodo.id}
                            todo={subTodo}
                            onToggle={onToggle}
                            onDelete={onDelete}
                            allTodos={allTodos}
                            onAddSubTask={onAddSubTask}
                            onUpdateDescription={onUpdateDescription}
                            onUpdateText={onUpdateText}
                            onUpdateLabel={onUpdateLabel}
                            onActivate={onActivate}
                            onSetDuration={onSetDuration}
                            onBuyback={onBuyback}
                            onBreakDown={onBreakDown}
                            onToggleTimer={onToggleTimer}
                            onOpen={onOpen}
                            viewContext={viewContext}
                            visibleIds={visibleIds}
                            parentTier={effectiveTier}
                            isDraggable={isDraggable}
                            showNestZones={showNestZones}
                            draggedTaskId={draggedTaskId}
                        />
                    ))}
                </SortableContext>

                {onAddSubTask && !isContextParent && (
                    <form onSubmit={handleSubTaskSubmit} className="flex items-center gap-2 group p-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-slate-600 group-focus-within:bg-indigo-500 transition-colors" />
                         <input
                            type="text"
                            value={subTaskInput}
                            onChange={(e) => setSubTaskInput(e.target.value)}
                            placeholder="Add nested task..."
                            className="bg-transparent border-b border-slate-700 focus:border-indigo-500 focus:outline-none text-sm text-slate-300 placeholder-slate-600 w-full py-2 transition-all"
                         />
                         <button 
                            type="submit" 
                            disabled={!subTaskInput.trim()}
                            className="text-slate-500 hover:text-indigo-400 disabled:opacity-30 p-3"
                         >
                            <Plus size={16} />
                         </button>
                    </form>
                )}

                {completedVisibleSubTasks.length > 0 && !isContextParent && (
                     <div className="pt-2 opacity-60">
                         {completedVisibleSubTasks.map(subTodo => (
                            <TodoItem
                                key={subTodo.id}
                                todo={subTodo}
                                onToggle={onToggle}
                                onDelete={onDelete}
                                allTodos={allTodos}
                                onAddSubTask={onAddSubTask}
                                onUpdateDescription={onUpdateDescription}
                                onUpdateText={onUpdateText}
                                onUpdateLabel={onUpdateLabel}
                                onActivate={onActivate}
                                onSetDuration={onSetDuration}
                                onBuyback={onBuyback}
                                onBreakDown={onBreakDown}
                                onToggleTimer={onToggleTimer}
                                onOpen={onOpen}
                                viewContext={viewContext}
                                visibleIds={visibleIds}
                                parentTier={effectiveTier}
                                isDraggable={false}
                            />
                        ))}
                     </div>
                )}
            </div>
        )}
    </div>
  );
};

export default React.memo(TodoItem);