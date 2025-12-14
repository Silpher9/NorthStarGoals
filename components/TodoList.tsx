import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plus, Calendar, Skull, Trophy, CheckCircle2, Target, X, ChevronLeft, ChevronRight, FolderOpen, StickyNote, Trash2, Tag, Layers, CornerDownRight, Pencil, BarChart3, Search, Filter, Square, CheckSquare, Clock, Settings, Upload, Download, AlertTriangle, List, Rocket, Globe, Archive, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import TodoItem from './TodoItem';
import RoutineManager from './RoutineManager';
import { Todo, Note, Routine } from '../types';
import { breakDownTask, generateTasksFromNote } from '../services/geminiService';
import { 
    createSyncRoom, 
    joinSyncRoom, 
    pushChanges, 
    subscribeToChanges, 
    disconnectSync,
    isSyncEnabled,
    getSyncState,
    SyncData,
    forceSync,
    getLastSyncedAt
} from '../services/syncService';

// Lazy load heavy components
const StatsView = React.lazy(() => import('./StatsView'));
const SettingsView = React.lazy(() => import('./SettingsView'));
const NotesView = React.lazy(() => import('./NotesView'));

type Tab = 'today' | 'completed' | 'graveyard' | 'archive' | 'goals' | 'notes' | 'stats' | 'settings';
type GoalTier = 'gold' | 'silver' | 'bronze';

// Threshold for auto-archiving (30 days in ms)
const ARCHIVE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

// Helper to generate ID
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Loading Component
const LoadingSpinner = () => (
    <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
        <p className="text-xs font-bold uppercase tracking-widest">Loading Module...</p>
    </div>
);

// --- ISOLATED INPUT COMPONENTS ---

const QuickAddForm: React.FC<{ onAdd: (text: string) => void }> = ({ onAdd }) => {
    const [quickAddInput, setQuickAddInput] = useState('');
    const handleQuickAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (quickAddInput.trim()) {
            onAdd(quickAddInput.trim());
            setQuickAddInput('');
        }
    };
    return (
        <form onSubmit={handleQuickAdd} className="relative group">
            <input 
                type="text" 
                value={quickAddInput}
                onChange={(e) => setQuickAddInput(e.target.value)}
                placeholder="Quick Add to Standard Orbit..."
                className="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-indigo-500 shadow-lg placeholder-slate-500 transition-all focus:bg-slate-800"
            />
            <button 
                type="submit"
                disabled={!quickAddInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-0 disabled:pointer-events-none transition-all shadow-md"
            >
                <Plus size={16} />
            </button>
        </form>
    );
};

const StandardTaskForm: React.FC<{ onAdd: (text: string) => void }> = ({ onAdd }) => {
    const [normalInput, setNormalInput] = useState('');
    const handleNormalSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (normalInput.trim()) {
            onAdd(normalInput.trim());
            setNormalInput('');
        }
    };
    return (
        <form onSubmit={handleNormalSubmit} className="mt-3 flex gap-2">
            <input 
                type="text" 
                value={normalInput}
                onChange={e => setNormalInput(e.target.value)}
                placeholder="Add standard task..."
                className="flex-grow bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <button type="submit" disabled={!normalInput.trim()} className="p-3 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-lg border border-slate-700">
                <Plus size={20} />
            </button>
        </form>
    );
};

interface ProjectTaskFormProps {
    onAdd: (text: string, label?: string) => void;
    goalText: string;
    style: { border: string; bg: string };
    labelOptions?: string[];
}
const ProjectTaskForm: React.FC<ProjectTaskFormProps> = ({ onAdd, goalText, style, labelOptions = [] }) => {
    const [input, setInput] = useState('');
    const [label, setLabel] = useState('');
    const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
    const [labelMenuIndex, setLabelMenuIndex] = useState(0);

    const filteredLabelOptions = useMemo(() => {
        const q = label.trim().toLowerCase();
        const opts = (labelOptions || []).filter(Boolean);
        if (!q) return opts;
        return opts.filter(opt => opt.toLowerCase().includes(q));
    }, [label, labelOptions]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onAdd(input.trim(), label.trim() || undefined);
            setInput('');
            setLabel('');
            setIsLabelMenuOpen(false);
            setLabelMenuIndex(0);
        }
    };

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
            if (isLabelMenuOpen && filteredLabelOptions[labelMenuIndex]) {
                e.preventDefault();
                setLabel(filteredLabelOptions[labelMenuIndex]);
                setIsLabelMenuOpen(false);
            }
            return;
        }
        if (e.key === 'Escape') {
            if (isLabelMenuOpen) {
                e.preventDefault();
                setIsLabelMenuOpen(false);
            }
        }
    };

    return (
        <div className={`bg-slate-900/95 md:bg-slate-800/90 md:backdrop-blur-md p-3 rounded-2xl border ${style.border} shadow-xl flex flex-col gap-2`}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-0">
                 <div className={`relative flex items-center gap-2 px-2 pb-2 border-b border-slate-700/50 mb-2`}>
                     <Tag size={12} className="text-slate-500" />
                     <input
                        type="text"
                        value={label}
                        onChange={(e) => { setLabel(e.target.value); setIsLabelMenuOpen(true); }}
                        onFocus={() => setIsLabelMenuOpen(true)}
                        onBlur={() => setIsLabelMenuOpen(false)}
                        onKeyDown={handleLabelKeyDown}
                        placeholder="Label (optional)..."
                        className="bg-transparent text-slate-300 placeholder-slate-500 text-xs focus:outline-none w-full"
                     />

                    {isLabelMenuOpen && filteredLabelOptions.length > 0 && (
                        <div
                            className="absolute left-0 top-full mt-2 w-full max-h-44 overflow-auto rounded-xl border border-slate-700/70 bg-slate-950/95 backdrop-blur shadow-2xl z-50"
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            {filteredLabelOptions.slice(0, 20).map((opt, idx) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setLabel(opt);
                                        setIsLabelMenuOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-[10px] uppercase font-bold tracking-wider transition-colors ${
                                        idx === labelMenuIndex ? 'bg-indigo-600/30 text-indigo-200' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="pl-2">
                        <div className={`w-2 h-2 rounded-full ${style.bg}`} />
                    </div>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Add nested task for ${goalText}...`}
                        className="flex-grow bg-transparent text-white placeholder-slate-400 focus:outline-none py-2 px-2 text-base"
                    />
                    <button 
                        type="submit"
                        disabled={!input.trim()}
                        className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white shadow-lg transition-all"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </form>
        </div>
    );
};

// --- END ISOLATED COMPONENTS ---

// Isolated Component for Daily Limit Countdown to prevent global re-renders
const DailyLimitCountdown: React.FC = () => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const timeUntilMidnight = useMemo(() => {
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const diff = midnight.getTime() - now;
        if (diff <= 0) return "00:00:00";
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }, [now]);

    return (
        <span className="text-xs font-bold font-mono">
            Daily Limit: {timeUntilMidnight}
        </span>
    );
};

interface MissionBriefingProps {
    onClose: () => void;
}

const MissionBriefing: React.FC<MissionBriefingProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/95 md:bg-black/80 md:backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl max-w-md w-full shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden relative">
                {/* Decorative scanning line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
                
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-400">
                            <Rocket size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-[0.1em] uppercase">Mission Briefing</h2>
                            <p className="text-xs text-cyan-400 font-mono">SYSTEM STATUS: ONLINE</p>
                        </div>
                    </div>

                    <div className="space-y-6 relative">
                        {/* Connecting line */}
                        <div className="absolute left-[19px] top-2 bottom-4 w-0.5 bg-slate-800 -z-10" />

                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 z-10 text-yellow-500 font-bold">1</div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-1">Establish Orbit</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    Navigate to the <span className="text-white font-bold">ORBIT</span> tab. Define your "North Star" (Gold Goal) and supporting objectives.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 z-10 text-purple-400 font-bold">2</div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-1">Chart Course</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    Click any goal to open the Project View. Break big goals down into smaller, actionable sub-tasks.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 z-10 text-emerald-400 font-bold">3</div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-1">Engage</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    Switch to the <span className="text-white font-bold">TODAY</span> view to execute. Set a timer to start tracking points.
                                </p>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={onClose}
                        className="mt-8 w-full py-4 bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-500/30 text-cyan-400 rounded-xl font-bold uppercase tracking-widest text-xs transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] min-h-[44px]"
                    >
                        Acknowledge & Initialize
                    </button>
                </div>
            </div>
        </div>
    );
};

interface GoalSlotProps {
    tier: GoalTier;
    index: number;
    existingGoal?: Todo;
    onAdd: (text: string, tier: GoalTier) => void;
    onDelete: (id: string) => void;
    onClick?: (id: string) => void;
}

const GoalSlot: React.FC<GoalSlotProps> = React.memo(({ tier, index, existingGoal, onAdd, onDelete, onClick }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState('');

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (val.trim()) {
            onAdd(val, tier);
            setVal('');
            setIsEditing(false);
        }
    };

    // Color Configs
    const configs = {
        gold: {
            border: 'border-yellow-500',
            bg: 'bg-yellow-900/20',
            hover: 'hover:bg-yellow-900/30',
            text: 'text-yellow-500',
            placeholder: 'Gold Goal',
            icon: <Trophy size={16} className="text-yellow-500" />
        },
        silver: {
            border: 'border-slate-300',
            bg: 'bg-slate-800/50',
            hover: 'hover:bg-slate-700/50',
            text: 'text-slate-300',
            placeholder: 'Silver Goal',
            icon: <Target size={16} className="text-slate-300" />
        },
        bronze: {
            border: 'border-orange-600',
            bg: 'bg-orange-900/20',
            hover: 'hover:bg-orange-900/30',
            text: 'text-orange-500',
            placeholder: 'Bronze Goal',
            icon: <Target size={16} className="text-orange-600" />
        }
    };
    const c = configs[tier];

    if (existingGoal) {
        return (
            <div 
                className={`w-full relative group p-4 rounded-xl border ${c.border} ${c.bg} ${c.hover} flex items-center justify-between shadow-lg transition-transform hover:scale-[1.02] cursor-pointer text-left`}
                onClick={() => onClick && onClick(existingGoal.id)}
            >
                <div className="flex items-center gap-3">
                    {c.icon}
                    <span className={`font-bold uppercase tracking-wider text-sm ${c.text}`}>{existingGoal.text}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete "${existingGoal.text}" and all its subtasks?`)) {
                                onDelete(existingGoal.id);
                            }
                        }}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-900/30 text-slate-500 hover:text-red-400 transition-all"
                        title="Delete goal"
                    >
                        <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className={`opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${c.text}`} />
                </div>
            </div>
        );
    }

    if (isEditing) {
        return (
            <form onSubmit={onSubmit} className={`p-4 rounded-xl border ${c.border} bg-slate-900 flex items-center gap-2 shadow-inner`}>
                <input 
                    autoFocus
                    type="text" 
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onBlur={() => !val && setIsEditing(false)}
                    placeholder={c.placeholder}
                    className={`bg-transparent w-full focus:outline-none ${c.text} text-sm font-medium uppercase tracking-wide placeholder:opacity-50`}
                />
                <button type="submit" disabled={!val.trim()} className="text-slate-400 hover:text-white p-2"><Plus size={16} /></button>
            </form>
        );
    }

    return (
        <button 
            onClick={() => setIsEditing(true)}
            className={`w-full p-4 rounded-xl border border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800/30 flex items-center justify-center gap-2 transition-all group`}
        >
            <Plus size={16} className="text-slate-600 group-hover/btn:text-slate-400" />
            <span className="text-xs uppercase font-bold text-slate-600 group-hover:text-slate-400">Set {tier} Goal</span>
        </button>
    );
});

interface ProjectViewProps {
    goal: Todo;
    tasks: Todo[];
    allTodos: Todo[];
    labelOptions?: string[];
    onBack: () => void;
    onAddTask: (text: string, customLabel?: string) => void;
    onAddSubTask: (parentId: string, text: string) => void;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdateDescription: (id: string, description: string) => void;
    onUpdateText: (id: string, text: string) => void;
    onUpdateLabel: (id: string, label: string) => void;
    onActivate: (id: string) => void;
    onSetDuration: (id: string, durationMinutes: number) => void;
    onBuyback: (id: string, cost: number) => void;
    onBreakDown: (id: string) => Promise<void>;
    totalPlannedTime: number;
}

const ProjectView: React.FC<ProjectViewProps> = ({ 
    goal, 
    tasks, 
    allTodos,
    labelOptions,
    onBack, 
    onAddTask, 
    onAddSubTask,
    onToggle, 
    onDelete, 
    onUpdateDescription,
    onUpdateText,
    onUpdateLabel,
    onActivate, 
    onSetDuration,
    onBuyback,
    onBreakDown,
    totalPlannedTime
}) => {
    // Determine style based on goal category or default to normal/purple
    const tier = (goal.goalCategory as GoalTier) || 'normal';
    
    // Style logic
    const styles = {
        gold: { text: 'text-yellow-500', border: 'border-yellow-500/50', bg: 'bg-yellow-500' },
        silver: { text: 'text-slate-300', border: 'border-slate-300/50', bg: 'bg-slate-400' },
        bronze: { text: 'text-orange-500', border: 'border-orange-500/50', bg: 'bg-orange-500' },
        normal: { text: 'text-purple-400', border: 'border-purple-500/50', bg: 'bg-purple-500' }
    };
    const s = styles[tier] || styles.normal;

    const handleDeleteProject = () => {
        if (window.confirm("Are you sure you want to delete this task and all its subtasks?")) {
            onDelete(goal.id);
            onBack();
        }
    };

    const activeTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    const isProject = goal.label === 'goal';

    return (
        <div className="h-full flex flex-col relative bg-slate-900/50">
            {/* Header */}
            <div className={`p-4 border-b border-slate-800 flex items-center gap-4 bg-slate-900/95 md:bg-slate-900/80 md:backdrop-blur sticky top-0 z-10`}>
                <button onClick={onBack} className="p-3 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <div className="flex-grow">
                    <div className="flex items-center gap-2">
                        {isProject ? <FolderOpen size={16} className={s.text} /> : <List size={16} className={s.text} />}
                        <h2 className={`text-lg font-bold uppercase tracking-widest ${s.text} truncate pr-2`}>{goal.text}</h2>
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">
                        {isProject ? 'Project View - Add Subgoals' : 'Task View - Add Subtasks'}
                    </p>
                </div>
                <button 
                    onClick={handleDeleteProject}
                    className="p-3 rounded-full hover:bg-red-900/20 text-slate-600 hover:text-red-400 transition-colors"
                    title="Delete"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            {/* Task List */}
            <div className="flex-grow overflow-y-auto p-4 pb-28 space-y-2">
                {activeTasks.length === 0 && completedTasks.length === 0 && (
                     <div className="text-center text-slate-600 mt-12">
                        <p>{isProject ? "No subgoals in this project yet." : "No nested tasks yet."}</p>
                        <p className="text-xs mt-2 text-slate-700">Add tasks below to break down your work.</p>
                     </div>
                )}
                
                {activeTasks.map(todo => (
                    <TodoItem 
                        key={todo.id} 
                        todo={todo} 
                        onToggle={onToggle} 
                        onDelete={onDelete}
                        allTodos={allTodos}
                        labelOptions={labelOptions}
                        onAddSubTask={onAddSubTask}
                        onUpdateDescription={onUpdateDescription}
                        onUpdateText={onUpdateText}
                        onUpdateLabel={onUpdateLabel}
                        onActivate={onActivate}
                        onSetDuration={onSetDuration}
                        onBuyback={onBuyback}
                        onBreakDown={onBreakDown}
                        parentTier={goal.goalCategory} // Pass project tier down for multipliers
                        viewContext="orbit"
                    />
                ))}

                {completedTasks.length > 0 && (
                    <div className="mt-8">
                        <div className="text-xs font-bold uppercase text-slate-600 mb-2 px-1">Completed</div>
                        {completedTasks.map(todo => (
                            <TodoItem 
                                key={todo.id} 
                                todo={todo} 
                                onToggle={onToggle} 
                                onDelete={onDelete}
                                allTodos={allTodos}
                                labelOptions={labelOptions}
                                onAddSubTask={onAddSubTask}
                                onUpdateDescription={onUpdateDescription}
                                onUpdateText={onUpdateText}
                                onUpdateLabel={onUpdateLabel}
                                onActivate={onActivate}
                                onSetDuration={onSetDuration}
                                onBuyback={onBuyback}
                                onBreakDown={onBreakDown}
                                parentTier={goal.goalCategory}
                                viewContext="orbit"
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#0f172a] via-[#0f172a] to-transparent z-20">
                <ProjectTaskForm onAdd={onAddTask} goalText={goal.text} style={s} labelOptions={labelOptions} />
            </div>
        </div>
    );
};

interface GoalManagementViewProps {
    todos: Todo[];
    routines: Routine[];
    labelOptions?: string[];
    onAddGoal: (text: string, tier: GoalTier) => void;
    onAddNormal: (text: string) => void;
    onDelete: (id: string) => void;
    onOpenProject: (id: string) => void;
    // Expanded Props for TodoItem functionality
    onToggle: (id: string) => void;
    onActivate: (id: string) => void;
    onSetDuration: (id: string, durationMinutes: number) => void;
    onUpdateDescription: (id: string, description: string) => void;
    onUpdateText: (id: string, text: string) => void;
    onUpdateLabel: (id: string, label: string) => void;
    onBuyback: (id: string, cost: number) => void;
    onBreakDown: (id: string) => Promise<void>;
    onAddSubTask: (parentId: string, text: string) => void;
    // Routine Props
    onAddRoutine: (routine: Omit<Routine, 'id' | 'createdAt' | 'lastGeneratedDate' | 'completedCycles' | 'streak'>) => void;
    onDeleteRoutine: (id: string) => void;
    totalPlannedTime: number;
}

const GoalManagementView: React.FC<GoalManagementViewProps> = ({ 
    todos, 
    routines,
    labelOptions,
    onAddGoal, 
    onAddNormal, 
    onDelete, 
    onOpenProject,
    onToggle,
    onActivate,
    onSetDuration,
    onUpdateDescription,
    onUpdateText,
    onUpdateLabel,
    onBuyback,
    onBreakDown,
    onAddSubTask,
    onAddRoutine,
    onDeleteRoutine,
    totalPlannedTime
}) => {
    const goals = useMemo(() => todos.filter(t => t.label === 'goal' && t.status !== 'graveyard'), [todos]);
    const goldGoal = useMemo(() => goals.find(g => g.goalCategory === 'gold'), [goals]);
    const silverGoals = useMemo(() => goals.filter(g => g.goalCategory === 'silver'), [goals]);
    const bronzeGoals = useMemo(() => goals.filter(g => g.goalCategory === 'bronze'), [goals]);

    // Filter for Normal tasks that are Top Level (no parent) and active
    const normalTasks = useMemo(() => todos.filter(t => t.label === 'normal' && !t.parentId && t.status !== 'graveyard' && !t.completed), [todos]);

    // Calculate Today's Load Display
    const formattedTotalTime = useMemo(() => {
        if (totalPlannedTime === 0) return "0m";
        const h = Math.floor(totalPlannedTime / 60);
        const m = totalPlannedTime % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    }, [totalPlannedTime]);

    const focusStatsStyle = useMemo(() => {
        const hours = totalPlannedTime / 60;
        const ratio = Math.min(hours / 8, 1);
        const hue = Math.round(140 * (1 - ratio));
        
        return {
            color: `hsl(${hue}, 85%, 60%)`,
            borderColor: `hsla(${hue}, 85%, 60%, 0.3)`,
            backgroundColor: `hsla(${hue}, 85%, 60%, 0.1)`
        };
    }, [totalPlannedTime]);

    return (
        <div className="h-full overflow-y-auto p-6 pb-32">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-light tracking-[0.2em] text-white">ORBITAL COMMAND</h2>
                <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Goal Configuration</p>
                
                {/* New Total Focus Timer Indicator */}
                <div className="flex justify-center mt-4">
                     <div 
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm border transition-colors duration-500 bg-slate-900/95 md:bg-slate-800/50 md:backdrop-blur-sm"
                        style={{ 
                            borderColor: focusStatsStyle.borderColor,
                            backgroundColor: focusStatsStyle.backgroundColor
                        }}
                    >
                        <Clock size={12} style={{ color: focusStatsStyle.color }} />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">
                            Today's Load: <span style={{ color: focusStatsStyle.color }}>{formattedTotalTime}</span>
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Global Quick Add Section - Isolated Component */}
            <div className="max-w-lg mx-auto mb-8">
                 <QuickAddForm onAdd={onAddNormal} />
            </div>

            <div className="space-y-8 max-w-lg mx-auto">
                {/* Gold Tier */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                        <Trophy size={14} className="text-yellow-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">North Star (Gold)</span>
                    </div>
                    <GoalSlot 
                        tier="gold" 
                        index={0} 
                        existingGoal={goldGoal} 
                        onAdd={onAddGoal} 
                        onDelete={onDelete} 
                        onClick={onOpenProject}
                    />
                </div>

                {/* Silver Tier */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                        <Target size={14} className="text-slate-300" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Support Vector (Silver)</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <GoalSlot tier="silver" index={0} existingGoal={silverGoals[0]} onAdd={onAddGoal} onDelete={onDelete} onClick={onOpenProject} />
                        <GoalSlot tier="silver" index={1} existingGoal={silverGoals[1]} onAdd={onAddGoal} onDelete={onDelete} onClick={onOpenProject} />
                    </div>
                </div>

                {/* Bronze Tier (Unlimited) */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                        <Target size={14} className="text-orange-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Ground Operations (Bronze)</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {bronzeGoals.map((bg, i) => (
                            <GoalSlot 
                                key={bg.id} 
                                tier="bronze" 
                                index={i} 
                                existingGoal={bg} 
                                onAdd={onAddGoal} 
                                onDelete={onDelete} 
                                onClick={onOpenProject} 
                            />
                        ))}
                        {/* Always show one empty slot at the end for adding more */}
                        <GoalSlot tier="bronze" index={bronzeGoals.length} onAdd={onAddGoal} onDelete={onDelete} />
                    </div>
                </div>

                {/* ROUTINES / FLIGHT PATTERNS (MOVED HERE) */}
                <RoutineManager 
                    routines={routines}
                    onAdd={onAddRoutine}
                    onDelete={onDeleteRoutine}
                />
                
                {/* Normal Tasks (Standard Orbit) */}
                <div className="pt-8 border-t border-slate-800">
                     <div className="flex items-center gap-2 mb-4">
                        <Globe size={14} className="text-purple-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Standard Orbit</span>
                    </div>
                    
                    <div>
                        {normalTasks.map(task => (
                            <TodoItem 
                                key={task.id} 
                                todo={task} 
                                onToggle={onToggle} 
                                onDelete={onDelete}
                                allTodos={todos}
                                labelOptions={labelOptions}
                                onAddSubTask={onAddSubTask}
                                onUpdateDescription={onUpdateDescription}
                                onUpdateText={onUpdateText}
                                onUpdateLabel={onUpdateLabel}
                                onActivate={onActivate}
                                onSetDuration={onSetDuration}
                                onBuyback={onBuyback}
                                onBreakDown={onBreakDown}
                                onOpen={onOpenProject} // Pass onOpen to show folder button
                                viewContext="orbit" // Allow full controls
                            />
                        ))}
                    </div>

                    <StandardTaskForm onAdd={onAddNormal} />
                </div>
            </div>
        </div>
    );
};

interface TodoListProps {
  onGoalsChange?: (goals: Todo[]) => void;
  onSyncStateChange?: (state: { status: 'disconnected' | 'connecting' | 'connected' | 'error'; lastSyncedAt: number | null }) => void;
  onForceSyncReady?: (handler: () => Promise<{ success: boolean; error?: string }>) => void;
}

const TodoList: React.FC<TodoListProps> = ({ onGoalsChange, onSyncStateChange, onForceSyncReady }) => {
  const LOCAL_UPDATED_AT_KEY = 'northstar_local_last_updated_at';

  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      const saved = localStorage.getItem('todos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [routines, setRoutines] = useState<Routine[]>(() => {
    try {
        const saved = localStorage.getItem('routines');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
  });

  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const saved = localStorage.getItem('notes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [viewingGoalId, setViewingGoalId] = useState<string | null>(null);
  
  // Sync state
  const [syncStatus, setSyncStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>(() => 
    isSyncEnabled() ? 'connected' : 'disconnected'
  );
  const syncUnsubscribeRef = useRef<(() => void) | null>(null);
  const isRemoteUpdateRef = useRef(false); // Flag to prevent push loops
  const isSyncInitializingRef = useRef(false); // Prevent pushing while bootstrapping sync
  // Safety latch: never push until we've successfully read the room once (or created it).
  // This prevents a fresh/empty device from wiping the room with empty localStorage.
  const hasRemoteBaselineRef = useRef(false);

  // Keep refs for non-todo collections too (used during initial sync decision)
  const routinesRef = useRef(routines);
  useEffect(() => { routinesRef.current = routines; }, [routines]);
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const getLocalUpdatedAt = () => {
    try {
      const raw = localStorage.getItem(LOCAL_UPDATED_AT_KEY);
      const n = raw ? Number(raw) : null;
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };

  const setLocalUpdatedAt = (ts: number) => {
    try {
      localStorage.setItem(LOCAL_UPDATED_AT_KEY, String(ts));
    } catch {
      // ignore
    }
  };

  const applyRemoteData = (data: SyncData) => {
    isRemoteUpdateRef.current = true;

    if (data.todos) setTodos(data.todos);
    if (data.routines) setRoutines(data.routines);
    if (data.notes) setNotes(data.notes);

    // Keep a local notion of "freshness" so we can choose direction on next startup.
    const remoteUpdatedAt = data.lastUpdated?.toMillis?.() ?? Date.now();
    setLocalUpdatedAt(remoteUpdatedAt);

    // Allow state to settle before we re-enable pushes
    setTimeout(() => {
      isRemoteUpdateRef.current = false;
    }, 150);
  };

  // Used label suggestions (for Orbit label dropdowns)
  const labelOptions = useMemo(() => {
      // Deduplicate case-insensitively but keep first-seen casing.
      const map = new Map<string, string>();
      for (const t of todos) {
          const raw = (t.customLabel || '').trim();
          if (!raw) continue;
          const key = raw.toLowerCase();
          if (!map.has(key)) map.set(key, raw);
      }
      return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [todos]);
  
  // Onboarding State
  const [showMissionBriefing, setShowMissionBriefing] = useState(() => {
      return !localStorage.getItem('hasSeenBriefing');
  });

  const closeBriefing = () => {
      setShowMissionBriefing(false);
      localStorage.setItem('hasSeenBriefing', 'true');
  };

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
    // Track local change time (but don't treat remote hydrations as "local edits")
    if (!isRemoteUpdateRef.current) {
      setLocalUpdatedAt(Date.now());
    }
    if (onGoalsChange) {
        // Emit active goals AND normal tasks for visualization
        const visualGoals = todos.filter(t => t.status === 'active' && !t.completed);
        onGoalsChange(visualGoals);
    }
  }, [todos, onGoalsChange]);

  useEffect(() => {
    localStorage.setItem('routines', JSON.stringify(routines));
    if (!isRemoteUpdateRef.current) {
      setLocalUpdatedAt(Date.now());
    }
  }, [routines]);

  useEffect(() => {
    localStorage.setItem('notes', JSON.stringify(notes));
    if (!isRemoteUpdateRef.current) {
      setLocalUpdatedAt(Date.now());
    }
  }, [notes]);

  // Use a ref for todos so callbacks can access latest state without dependency
  // This is crucial for performance optimization so TodoItem doesn't re-render when TodoList re-renders
  // unless strictly necessary.
  const todosRef = useRef(todos);
  useEffect(() => { todosRef.current = todos; }, [todos]);

  // --- ROUTINE GENERATOR LOGIC ---
  useEffect(() => {
     // Run check on mount and whenever routines config changes
     const now = new Date();
     
     // CRITICAL FIX: Use Local Time, not UTC for todayStr to match getDay() logic.
     // toISOString() uses UTC. We need YYYY-MM-DD in local time.
     const offset = now.getTimezoneOffset();
     const localDate = new Date(now.getTime() - (offset*60*1000));
     const todayStr = localDate.toISOString().split('T')[0]; // YYYY-MM-DD
     
     const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
     const dayOfMonth = now.getDate(); // 1-31

     // Helper for Bi-Weekly parity (ISO Week number based)
     const getWeekNumber = (d: Date) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return weekNo;
     };
     const currentWeek = getWeekNumber(now);

     setRoutines(prev => {
        let hasUpdates = false;
        const newTasks: Todo[] = [];
        
        // Use map to create new array instead of modifying prev directly (Strict Mode safety)
        const newRoutines = prev.map(routine => {
            // 1. Skip if already generated today
            if (routine.lastGeneratedDate === todayStr) return routine;

            // 2. Check Triggers
            let shouldRun = false;

            if (routine.frequency === 'weekly') {
                if (routine.daysOfWeek.includes(dayOfWeek)) shouldRun = true;
            } else if (routine.frequency === 'biweekly') {
                // Determine start week parity based on creation
                const startWeek = getWeekNumber(new Date(routine.createdAt));
                // Run if current week parity matches start week parity AND day matches
                if ((currentWeek % 2 === startWeek % 2) && routine.daysOfWeek.includes(dayOfWeek)) {
                    shouldRun = true;
                }
            } else if (routine.frequency === 'monthly') {
                if (dayOfMonth === routine.dayOfMonth) shouldRun = true;
            }

            // 3. Spawn Task
            if (shouldRun) {
                hasUpdates = true;
                
                // CALCULATE MULTIPLIER BASED ON STREAK
                // Streak = number of tasks completed.
                // Every 4 tasks (approx 1 week of consistent work), add 0.1x. Cap at 1.5x.
                const currentStreak = routine.streak || 0;
                let multiplier = 1 + (Math.floor(currentStreak / 4) * 0.1);
                if (multiplier > 1.5) multiplier = 1.5;

                // Create Task
                const newTask: Todo = {
                    id: generateId(),
                    text: routine.title,
                    completed: false,
                    createdAt: Date.now(),
                    status: 'active',
                    label: 'normal',
                    customLabel: routine.label || 'Routine',
                    routineId: routine.id,
                    isActivated: true, // Auto-activate into Today view
                    activationDeadline: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime(), // End of Today
                    multiplier: multiplier // Attach velocity multiplier
                };
                newTasks.push(newTask);
                
                // Return updated routine object
                return { ...routine, lastGeneratedDate: todayStr };
            }
            
            return routine;
        });

        if (hasUpdates) {
            // Queue state update for Todos if tasks generated
            if (newTasks.length > 0) {
                setTodos(currentTodos => [...newTasks, ...currentTodos]);
            }
            return newRoutines;
        }
        return prev;
     });
  }, [routines]); // Use routines object as dependency to ensure updates catch fresh state
  
  // Daily Deadline Check - Only check for expiration, do NOT decrement timer here
  useEffect(() => {
    const interval = setInterval(() => {
        const now = Date.now();
        setTodos(prev => {
            let hasChanges = false;
            
            const next = prev.map(t => {
                // Check if task deadline (Midnight) has passed for active tasks
                if (t.status === 'active' && t.isActivated && t.activationDeadline && now > t.activationDeadline) {
                    hasChanges = true;
                    return { 
                        ...t, 
                        status: 'graveyard' as const, 
                        resolvedAt: now, 
                        isPlaying: false,
                        isActivated: false,
                        lastStartedAt: undefined
                    };
                }
                return t;
            });
            
            return hasChanges ? next : prev;
        });
    }, 1000); // Check every second for midnight expiry, but doesn't cause render unless state changes
    return () => clearInterval(interval);
  }, []);

  // Auto-Archive Logic (Background Process)
  useEffect(() => {
    const checkArchival = () => {
        const now = Date.now();
        setTodos(prev => {
            let hasChanges = false;
            const next = prev.map(t => {
                // Only archive 'active' status tasks created more than THRESHOLD ago
                if (t.status === 'active') {
                    if (now - t.createdAt > ARCHIVE_THRESHOLD_MS) {
                         hasChanges = true;
                         return { ...t, status: 'archive' as const };
                    }
                }
                return t;
            });
            return hasChanges ? next : prev;
        });
    };

    // Run check immediately on mount
    checkArchival();
    
    // Run periodically (every hour)
    const interval = setInterval(checkArchival, 60 * 60 * 1000); 
    return () => clearInterval(interval);
  }, []);

  // --- CLOUD SYNC LOGIC ---
  
  // Set up real-time listener on mount if already connected
  useEffect(() => {
    let cancelled = false;

    const setupSync = async () => {
      if (!isSyncEnabled()) return;

      isSyncInitializingRef.current = true;
      setSyncStatus('connecting');

      try {
        // Pull remote first to avoid wiping the room with empty localStorage on a fresh device.
        const state = getSyncState();
        const code = state.syncCode;

        if (code) {
          const remote = await joinSyncRoom(code);
          if (cancelled) return;

          if (remote) {
            // We successfully read the room at least once.
            hasRemoteBaselineRef.current = true;

            const localTodos = todosRef.current || [];
            const localRoutines = routinesRef.current || [];
            const localNotes = notesRef.current || [];

            const localCount = localTodos.length + localRoutines.length + localNotes.length;
            const remoteCount = (remote.todos?.length || 0) + (remote.routines?.length || 0) + (remote.notes?.length || 0);

            const localUpdatedAt = getLocalUpdatedAt();
            const remoteUpdatedAt = remote.lastUpdated?.toMillis?.() ?? null;

            const remoteLooksNewer =
              remoteUpdatedAt !== null &&
              (localUpdatedAt === null || remoteUpdatedAt > localUpdatedAt + 1000);

            const localLooksNewer =
              localUpdatedAt !== null &&
              (remoteUpdatedAt === null || localUpdatedAt > remoteUpdatedAt + 1000);

            if (remoteLooksNewer || (remoteCount > 0 && localCount === 0)) {
              applyRemoteData(remote);
            } else if (localLooksNewer || (localCount > 0 && remoteCount === 0)) {
              // Remote is empty/stale but we have local data -> push local up.
              await pushChanges({ todos: localTodos, routines: localRoutines, notes: localNotes });
            } else if (remoteCount > 0) {
              // Tie-breaker: prefer remote when both have data.
              applyRemoteData(remote);
            }
          }
        }

        // Subscribe for realtime updates after initial direction decision
        const unsubscribe = subscribeToChanges(
          (data: SyncData) => {
            if (cancelled) return;
            // Subscription snapshot confirms we can read the room.
            hasRemoteBaselineRef.current = true;
            applyRemoteData(data);
          },
          (error) => {
            console.error('Sync error:', error);
            setSyncStatus('error');
          },
          () => {
            if (cancelled) return;
            // Room doc is missing (deleted). Treat this as a safe baseline and recreate it by pushing local.
            if (hasRemoteBaselineRef.current) return;
            hasRemoteBaselineRef.current = true;

            const localTodos = todosRef.current || [];
            const localRoutines = routinesRef.current || [];
            const localNotes = notesRef.current || [];

            pushChanges({ todos: localTodos, routines: localRoutines, notes: localNotes }).catch(err => {
              console.error('Failed to recreate missing sync room:', err);
              setSyncStatus('error');
            });
          }
        );

        if (unsubscribe) {
          syncUnsubscribeRef.current = unsubscribe;
          setSyncStatus('connected');
        } else {
          setSyncStatus('error');
        }
      } catch (e) {
        console.error('Sync setup failed:', e);
        setSyncStatus('error');
      } finally {
        // Allow pushes after initial bootstrap (remote pull/push decision done)
        isSyncInitializingRef.current = false;
      }
    };

    setupSync();
    
    return () => {
      cancelled = true;
      if (syncUnsubscribeRef.current) {
        syncUnsubscribeRef.current();
        syncUnsubscribeRef.current = null;
      }
    };
  }, []);

  // Debounced push to cloud when local data changes
  useEffect(() => {
    // Skip if this is a remote update (prevents infinite loop)
    if (isRemoteUpdateRef.current) return;

    // Skip if we are still bootstrapping sync
    if (isSyncInitializingRef.current) return;
    
    // Skip if sync is not enabled
    if (!isSyncEnabled()) return;

    // Critical safety: don't push until we've successfully read the room once (or created it)
    if (!hasRemoteBaselineRef.current) return;
    
    // Debounce the push to avoid too many writes
    const timeout = setTimeout(() => {
      pushChanges({ todos, routines, notes }).catch(err => {
        console.error('Failed to push changes:', err);
      });
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timeout);
  }, [todos, routines, notes]);

  // Push changes when page visibility changes (user switches apps on mobile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isSyncInitializingRef.current) return;
      if (!hasRemoteBaselineRef.current) return;
      if (document.visibilityState === 'hidden' && isSyncEnabled()) {
        // Push immediately without debounce when going to background
        pushChanges({ todos, routines, notes }).catch(err => {
          console.error('Failed to push on visibility change:', err);
        });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [todos, routines, notes]);

  // Force sync handler for external use (e.g., sync button)
  const handleForceSync = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!isSyncEnabled()) {
      return { success: false, error: 'Sync not enabled' };
    }
    const result = await forceSync({ todos, routines, notes });
    return result;
  }, [todos, routines, notes]);

  // Notify parent of sync state changes
  useEffect(() => {
    if (onSyncStateChange) {
      onSyncStateChange({ status: syncStatus, lastSyncedAt: getLastSyncedAt() });
    }
  }, [syncStatus, onSyncStateChange]);

  // Provide force sync handler to parent
  useEffect(() => {
    if (onForceSyncReady) {
      onForceSyncReady(handleForceSync);
    }
  }, [handleForceSync, onForceSyncReady]);

  // Sync handlers
  const handleEnableSync = useCallback(async (code: string): Promise<boolean> => {
    setSyncStatus('connecting');
    
    const success = await createSyncRoom(code, { todos, routines, notes });
    
    if (success) {
      // Room exists and we know its baseline (our current state).
      hasRemoteBaselineRef.current = true;
      // Set up real-time listener
      const unsubscribe = subscribeToChanges(
        (data: SyncData) => {
          hasRemoteBaselineRef.current = true;
          applyRemoteData(data);
        },
        () => setSyncStatus('error'),
        () => {
          // Room doc missing (deleted). Recreate it from our local state.
          if (hasRemoteBaselineRef.current) return;
          hasRemoteBaselineRef.current = true;
          pushChanges({
            todos: todosRef.current || [],
            routines: routinesRef.current || [],
            notes: notesRef.current || []
          }).catch(err => {
            console.error('Failed to recreate missing sync room:', err);
            setSyncStatus('error');
          });
        }
      );
      
      if (unsubscribe) {
        syncUnsubscribeRef.current = unsubscribe;
      }
      setSyncStatus('connected');
      return true;
    }
    
    setSyncStatus('error');
    return false;
  }, [todos, routines, notes]);

  const handleJoinSync = useCallback(async (code: string): Promise<boolean> => {
    setSyncStatus('connecting');
    
    const data = await joinSyncRoom(code);
    
    if (data) {
      hasRemoteBaselineRef.current = true;
      // Update local state with remote data
      applyRemoteData(data);
      
      // Set up real-time listener
      const unsubscribe = subscribeToChanges(
        (remoteData: SyncData) => {
          hasRemoteBaselineRef.current = true;
          applyRemoteData(remoteData);
        },
        () => setSyncStatus('error'),
        () => {
          // Room doc missing (deleted). Recreate it from our local state.
          if (hasRemoteBaselineRef.current) return;
          hasRemoteBaselineRef.current = true;
          pushChanges({
            todos: todosRef.current || [],
            routines: routinesRef.current || [],
            notes: notesRef.current || []
          }).catch(err => {
            console.error('Failed to recreate missing sync room:', err);
            setSyncStatus('error');
          });
        }
      );
      
      if (unsubscribe) {
        syncUnsubscribeRef.current = unsubscribe;
      }
      setSyncStatus('connected');
      return true;
    }
    
    setSyncStatus('disconnected');
    return false;
  }, []);

  const handleDisconnectSync = useCallback(() => {
    if (syncUnsubscribeRef.current) {
      syncUnsubscribeRef.current();
      syncUnsubscribeRef.current = null;
    }
    disconnectSync();
    setSyncStatus('disconnected');
  }, []);

  // --- END CLOUD SYNC LOGIC ---

  const addTodo = useCallback((text: string, label: 'goal' | 'normal' = 'normal', parentId?: string, goalCategory?: string, customLabel?: string) => {
    setTodos(prev => {
        const newTodo: Todo = {
            id: generateId(),
            text,
            completed: false,
            createdAt: Date.now(),
            status: 'active',
            label,
            parentId,
            goalCategory,
            customLabel
        };
        return [newTodo, ...prev];
    });
  }, []);
  
  const addBatchTodos = useCallback((texts: string[], parentId?: string) => {
      setTodos(prev => {
        const newTodos: Todo[] = texts.map(text => ({
            id: generateId(),
            text,
            completed: false,
            createdAt: Date.now(),
            status: 'active',
            label: 'normal',
            parentId: parentId
        }));
        return [...newTodos, ...prev];
      });
  }, []);

  // Routine Handlers
  const handleAddRoutine = useCallback((routineData: Omit<Routine, 'id' | 'createdAt' | 'lastGeneratedDate' | 'completedCycles' | 'streak'>) => {
      const newRoutine: Routine = {
          ...routineData,
          id: generateId(),
          createdAt: Date.now(),
          completedCycles: 0,
          streak: 0
      };
      setRoutines(prev => [...prev, newRoutine]);
  }, []);

  const handleDeleteRoutine = useCallback((id: string) => {
      if(window.confirm("Delete this routine? It will stop generating tasks.")) {
        setRoutines(prev => prev.filter(r => r.id !== id));
      }
  }, []);

  const handleAddGoal = useCallback((text: string, tier: GoalTier) => {
      addTodo(text, 'goal', undefined, tier);
  }, [addTodo]);
  
  const handleAddNormal = useCallback((text: string) => {
      addTodo(text, 'normal');
  }, [addTodo]);

  const handleAddSubTask = useCallback((parentId: string, text: string) => {
      addTodo(text, 'normal', parentId);
  }, [addTodo]);
  
  // Optimized delete
  const deleteTodo = useCallback((id: string) => {
      setTodos(prev => {
          const toDelete = new Set([id]);
          // Recursive delete children
          const findChildren = (pid: string) => {
              prev.forEach(t => {
                  if (t.parentId === pid) {
                      toDelete.add(t.id);
                      findChildren(t.id);
                  }
              });
          };
          findChildren(id);
          return prev.filter(t => !toDelete.has(t.id));
      });
  }, []);

  const toggleTodo = useCallback((id: string) => {
    // 1. Update Todo Status
    setTodos(prev => prev.map(t => {
      if (t.id === id) {
        // If it's in archive, restore to active
        if (t.status === 'archive') {
             return { ...t, status: 'active' };
        }

        const completed = !t.completed;
        return {
          ...t,
          completed,
          resolvedAt: completed ? Date.now() : undefined,
          isPlaying: false, // Stop timer if completed
          lastStartedAt: undefined
        };
      }
      return t;
    }));
    
    // 2. Update Routine Stats if linked
    // Accessing `todosRef.current` is safe here.
    const task = todosRef.current.find(t => t.id === id);
    if (task && task.routineId) {
        // If we are marking as COMPLETE (was false)
        if (!task.completed) {
            setRoutines(prev => prev.map(r => {
                if (r.id === task.routineId) {
                    return {
                        ...r,
                        completedCycles: r.completedCycles + 1,
                        streak: (r.streak || 0) + 1
                    };
                }
                return r;
            }));
        } else {
            // If marking as incomplete, decrement?
            // For simplicity and user forgiveness, let's decrement.
            setRoutines(prev => prev.map(r => {
                 if (r.id === task.routineId) {
                    return {
                        ...r,
                        completedCycles: Math.max(0, r.completedCycles - 1),
                        streak: Math.max(0, (r.streak || 0) - 1)
                    };
                }
                return r;
            }));
        }
    }
  }, []);

  const updateDescription = useCallback((id: string, description: string) => {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, description } : t));
  }, []);

  const updateText = useCallback((id: string, text: string) => {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, text } : t));
  }, []);

  const updateLabel = useCallback((id: string, customLabel: string) => {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, customLabel: customLabel || undefined } : t));
  }, []);
  
  const activateTask = useCallback((id: string) => {
      const now = new Date();
      // Set deadline to next midnight (24:00 today)
      const deadline = new Date(now);
      deadline.setHours(24, 0, 0, 0);

      setTodos(prev => prev.map(t => {
          if (t.id === id) {
              return { 
                  ...t, 
                  isActivated: true,
                  isPlaying: false, // Ensure it starts paused per requirement
                  lastStartedAt: undefined,
                  activationDeadline: deadline.getTime()
              };
          }
          return t;
      }));
  }, []);

  const setTaskDuration = useCallback((id: string, durationMinutes: number) => {
      setTodos(prev => prev.map(t => {
          if (t.id === id) {
              return { 
                  ...t, 
                  durationMinutes,
                  remainingTime: durationMinutes * 60 * 1000,
                  isPlaying: false,
                  lastStartedAt: undefined
              };
          }
          return t;
      }));
  }, []);
  
  const toggleTimer = useCallback((id: string) => {
      setTodos(prev => {
          const now = Date.now();
          return prev.map(t => {
              // Target task toggling
              if (t.id === id) {
                  if (t.isPlaying) {
                      // PAUSE: Calculate elapsed time and update remainingTime snapshot
                      const elapsed = t.lastStartedAt ? (now - t.lastStartedAt) : 0;
                      const newRemaining = Math.max(0, (t.remainingTime || 0) - elapsed);
                      
                      return { 
                          ...t, 
                          isPlaying: false, 
                          remainingTime: newRemaining,
                          lastStartedAt: undefined
                      };
                  } else {
                      // START: Set timestamp
                      return { 
                          ...t, 
                          isPlaying: true, 
                          lastStartedAt: now 
                      };
                  }
              }
              
              // Ensure exclusivity: Pause any other playing timer
              if (t.isPlaying) {
                  const elapsed = t.lastStartedAt ? (now - t.lastStartedAt) : 0;
                  const newRemaining = Math.max(0, (t.remainingTime || 0) - elapsed);
                  return { 
                      ...t, 
                      isPlaying: false, 
                      remainingTime: newRemaining,
                      lastStartedAt: undefined
                  };
              }
              
              return t;
          });
      });
  }, []);
  
  const buybackTask = useCallback((taskId: string, cost: number) => {
      setTodos(prev => {
          // Robustly find the root ancestor that is responsible for the current state (Active or Graveyard)
          const findRoot = (currentId: string): string => {
              const t = prev.find(i => i.id === currentId);
              if (!t) return currentId;
              
              // If this task is the active root or the graveyard root, we found it.
              if (t.isActivated || t.status === 'graveyard') return t.id;
              
              // If it has a parent, keep climbing
              if (t.parentId) return findRoot(t.parentId);
              
              // If we reached top and found nothing specific, assume this is the root
              return t.id;
          };

          const rootId = findRoot(taskId);

          return prev.map(t => {
              let updates = { ...t };
              let hasUpdates = false;

              // 1. Record the cost history on the specific task clicked
              if (t.id === taskId) {
                  updates.buybackHistory = [...(t.buybackHistory || []), { timestamp: Date.now(), cost }];
                  hasUpdates = true;
              }

              // 2. Deactivate/Revive the root task (which sends the whole tree back to orbit)
              if (t.id === rootId) {
                  updates.status = 'active';
                  updates.isActivated = false;
                  updates.isPlaying = false;
                  updates.lastStartedAt = undefined;
                  updates.resolvedAt = undefined;
                  updates.activationDeadline = undefined;
                  
                  // If reviving from graveyard, reset creation time to avoid immediate auto-archive
                  if (t.status === 'graveyard') {
                      updates.createdAt = Date.now();
                  }
                  hasUpdates = true;
              }

              return hasUpdates ? updates : t;
          });
      });
  }, []);

  const handleBreakDown = useCallback(async (id: string) => {
      // Use Ref to get current state without adding dependency
      const currentTodos = todosRef.current;
      const task = currentTodos.find(t => t.id === id);
      if (!task) return;

      try {
          // Simplified string conversion to handle any potential type mismatch from localStorage
          const textToBreak = task.text ? String(task.text) : '';
          
          const subTasks = await breakDownTask(textToBreak);
          // Explicitly typing raw array to handle 'any' return from breakDownTask potentially
          const raw: any[] = subTasks as any[]; 
          if (raw && raw.length > 0) {
              setTodos(prev => {
                  const newTodos = raw.map(st => ({
                      id: generateId(),
                      text: String(st),
                      completed: false,
                      createdAt: Date.now(),
                      status: 'active' as const,
                      label: 'normal' as const,
                      parentId: id
                  }));
                  return [...newTodos, ...prev];
              });
          }
      } catch (error: any) {
          console.error("Failed to break down task", error);
          alert("Could not break down task. Check API Key.");
      }
  }, []);

  // Note Handlers
  const addNote = useCallback((text: string, label?: string) => {
      const newNote: Note = { id: generateId(), text, createdAt: Date.now(), label };
      setNotes(prev => [newNote, ...prev]);
  }, []);
  const updateNote = useCallback((id: string, text: string) => {
      setNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
  }, []);
  const deleteNote = useCallback((id: string) => setNotes(prev => prev.filter(n => n.id !== id)), []);

  // Settings Handlers
  const handleExport = useCallback(() => {
      // Use ref for export to avoid stale state in callback if not updating
      const data = { todos: todosRef.current, routines, notes, version: 1, exportedAt: Date.now() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const now = new Date();
      // Format: YYYY-MM-DD_HH-mm-ss
      const timestamp = now.toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 19);
      a.download = `north-star-backup-${timestamp}.json`;
      
      a.click();
  }, [notes, routines]);
  
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const target = evt.target as FileReader;
          const result = target?.result;
          try {
              if (typeof result === 'string') {
                const data = JSON.parse(result);
                if (data.todos) setTodos(data.todos);
                if (data.routines) setRoutines(data.routines);
                if (data.notes) setNotes(data.notes);
                alert("Data restored successfully.");
              }
          } catch (err: any) {
              console.error(err);
              alert("Failed to import data.");
          }
      };
      reader.readAsText(file);
  }, []);
  
  const clearAll = useCallback(() => {
      // Disconnect sync first to avoid pushing empty data
      handleDisconnectSync();
      
      setTodos([]);
      setRoutines([]);
      setNotes([]);
      localStorage.removeItem('todos');
      localStorage.removeItem('routines');
      localStorage.removeItem('notes');
  }, [handleDisconnectSync]);

  // View Logic
  const activeTodos = useMemo(() => {
    // 1. Get all explicitly activated nodes (Roots of the day)
    const activatedRoots = todos.filter(t => !t.completed && t.status === 'active' && t.isActivated);
    
    // 2. Helper to find deepest actionable leaves
    // If a task has children that are active and not completed, it is not a leaf.
    const getActiveLeaves = (item: Todo): Todo[] => {
        const children = todos.filter(t => t.parentId === item.id && t.status === 'active' && !t.completed);
        if (children.length === 0) {
            return [item];
        }
        return children.flatMap(child => getActiveLeaves(child));
    };

    // 3. Flatten to unique leaves
    // Use a Map to deduplicate if multiple paths lead to same leaf (unlikely in tree but safe)
    const leafMap = new Map<string, Todo>();
    activatedRoots.forEach(root => {
        const leaves = getActiveLeaves(root);
        leaves.forEach(leaf => leafMap.set(leaf.id, leaf));
    });

    // 4. Return sorted list
    return Array.from(leafMap.values()).sort((a,b) => b.createdAt - a.createdAt);
  }, [todos]);

  const totalPlannedMinutes = useMemo(() => {
    return activeTodos.reduce((acc, t) => acc + (t.durationMinutes || 0), 0);
  }, [activeTodos]);

  const formattedTotalTime = useMemo(() => {
      if (totalPlannedMinutes === 0) return null;
      const h = Math.floor(totalPlannedMinutes / 60);
      const m = totalPlannedMinutes % 60;
      if (h > 0 && m > 0) return `${h}h ${m}m`;
      if (h > 0) return `${h}h`;
      return `${m}m`;
  }, [totalPlannedMinutes]);

  const focusStatsStyle = useMemo(() => {
      const hours = totalPlannedMinutes / 60;
      // Cap at 8 hours for the full red
      const ratio = Math.min(hours / 8, 1);
      // Interpolate hue from 140 (Emerald/Green) to 0 (Red)
      const hue = Math.round(140 * (1 - ratio));
      
      return {
          color: `hsl(${hue}, 85%, 60%)`,
          borderColor: `hsla(${hue}, 85%, 60%, 0.3)`,
          backgroundColor: `hsla(${hue}, 85%, 60%, 0.1)`
      };
  }, [totalPlannedMinutes]);

  const completedTodos = useMemo(() => todos.filter(t => t.completed && t.status !== 'archive' && t.status !== 'graveyard').sort((a,b) => (b.resolvedAt || 0) - (a.resolvedAt || 0)), [todos]);
  const failedTodos = useMemo(() => todos.filter(t => t.status === 'graveyard').sort((a,b) => (b.resolvedAt || 0) - (a.resolvedAt || 0)), [todos]);
  const archivedTodos = useMemo(() => todos.filter(t => t.status === 'archive').sort((a,b) => b.createdAt - a.createdAt), [todos]);

  if (viewingGoalId) {
      const goal = todos.find(t => t.id === viewingGoalId);
      if (goal) {
          return (
            <ProjectView 
                goal={goal}
                tasks={todos.filter(t => t.parentId === goal.id && t.status !== 'graveyard')}
                allTodos={todos}
                labelOptions={labelOptions}
                onBack={() => setViewingGoalId(null)}
                // Use a closure here to pass current ID without breaking hook rules
                onAddTask={(text, label) => addTodo(text, 'normal', goal.id, undefined, label)}
                onAddSubTask={handleAddSubTask}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                onUpdateDescription={updateDescription}
                onUpdateText={updateText}
                onUpdateLabel={updateLabel}
                onActivate={activateTask}
                onSetDuration={setTaskDuration}
                onBuyback={buybackTask}
                onBreakDown={handleBreakDown}
                totalPlannedTime={totalPlannedMinutes}
            />
          );
      }
      // If goal not found (deleted?), go back
      setViewingGoalId(null);
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 md:bg-slate-900/80 md:backdrop-blur-sm relative">
      {showMissionBriefing && <MissionBriefing onClose={closeBriefing} />}

      {/* Navigation */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900 md:bg-[#0f172a]/90">
        <div className="flex bg-slate-800/50 rounded-lg p-1 overflow-x-auto no-scrollbar max-w-[75vw]">
          {(['orbit', 'today', 'completed', 'graveyard', 'archive', 'notes', 'stats'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab === 'orbit' ? 'goals' : tab as Tab)}
              className={`
                px-4 py-3 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 min-h-[44px]
                ${(activeTab === tab || (tab === 'orbit' && activeTab === 'goals')) ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              {tab === 'orbit' && <Rocket size={12} />}
              {tab === 'today' && <CheckSquare size={12} />}
              {tab === 'completed' && <CheckCircle2 size={12} />}
              {tab === 'graveyard' && <Skull size={12} />}
              {tab === 'archive' && <Archive size={12} />}
              {tab === 'notes' && <StickyNote size={12} />}
              {tab === 'stats' && <BarChart3 size={12} />}
              {tab}
            </button>
          ))}
        </div>
        <button 
            onClick={() => setActiveTab('settings')}
            className={`p-3 rounded-lg transition-colors ${activeTab === 'settings' ? 'text-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-white'}`}
        >
            <Settings size={18} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow overflow-hidden relative">
        {activeTab === 'goals' && (
            <GoalManagementView 
                todos={todos} 
                routines={routines}
                labelOptions={labelOptions}
                onAddGoal={handleAddGoal} 
                onAddNormal={handleAddNormal}
                onDelete={deleteTodo} 
                onOpenProject={setViewingGoalId} 
                onToggle={toggleTodo}
                onActivate={activateTask}
                onSetDuration={setTaskDuration}
                onUpdateDescription={updateDescription}
                onUpdateText={updateText}
                onUpdateLabel={updateLabel}
                onBuyback={buybackTask}
                onBreakDown={handleBreakDown}
                onAddSubTask={handleAddSubTask}
                onAddRoutine={handleAddRoutine}
                onDeleteRoutine={handleDeleteRoutine}
                totalPlannedTime={totalPlannedMinutes}
            />
        )}

        {activeTab === 'today' && (
            <div className="h-full overflow-y-auto p-4 pb-32">
                 <div className="text-center mb-6">
                    <h2 className="text-xl font-light text-white tracking-[0.2em] uppercase">Today's Mission</h2>
                    <div className="flex flex-col items-center gap-1.5 mt-2">
                        <p className="text-[10px] text-slate-500 font-mono">
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                        
                        <div className="flex items-center gap-4">
                            {formattedTotalTime && (
                                <div 
                                    className="flex items-center gap-2 px-3 py-1 rounded-full shadow-sm border transition-colors duration-500"
                                    style={{ 
                                        borderColor: focusStatsStyle.borderColor,
                                        backgroundColor: focusStatsStyle.backgroundColor
                                    }}
                                >
                                    <Clock size={12} style={{ color: focusStatsStyle.color }} />
                                    <span className="text-xs font-bold text-slate-300">
                                        Total Focus: <span style={{ color: focusStatsStyle.color }}>{formattedTotalTime}</span>
                                    </span>
                                </div>
                            )}

                            {activeTodos.length > 0 && (
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full shadow-sm border border-red-500/30 bg-red-900/10 text-red-400">
                                    <Clock size={12} className="animate-pulse" />
                                    {/* Isolated Component for Countdown */}
                                    <DailyLimitCountdown />
                                </div>
                            )}
                        </div>
                    </div>
                 </div>
                 
                 {activeTodos.length === 0 ? (
                     <div className="flex flex-col items-center justify-center mt-20 opacity-40">
                         <Rocket size={48} className="text-slate-600 mb-4" />
                         <p className="text-sm text-slate-400 font-medium">Orbit established. Awaiting orders.</p>
                         <p className="text-xs text-slate-600 mt-2">Go to Orbit tab to plan tasks.</p>
                     </div>
                 ) : (
                     activeTodos.map(todo => (
                        <TodoItem 
                            key={todo.id} 
                            todo={todo} 
                            onToggle={toggleTodo} 
                            onDelete={deleteTodo} 
                            allTodos={todos}
                            labelOptions={labelOptions}
                            // Removed onAddSubTask to prevent creating tasks in Today view
                            onUpdateDescription={updateDescription}
                            onUpdateText={updateText}
                            onUpdateLabel={updateLabel}
                            onActivate={activateTask}
                            onSetDuration={setTaskDuration}
                            onBuyback={buybackTask}
                            onBreakDown={handleBreakDown}
                            onToggleTimer={toggleTimer}
                            viewContext="today"
                        />
                     ))
                 )}
            </div>
        )}

        {activeTab === 'completed' && (
            <div className="h-full overflow-y-auto p-4 pb-20">
                <h2 className="text-lg font-light text-white tracking-[0.2em] uppercase mb-6 pl-2 border-l-2 border-emerald-500">Mission Log</h2>
                {completedTodos.map(todo => (
                    <TodoItem 
                        key={todo.id} 
                        todo={todo} 
                        onToggle={toggleTodo} 
                        onDelete={deleteTodo} 
                        allTodos={todos}
                        viewContext="list"
                    />
                ))}
            </div>
        )}

        {activeTab === 'graveyard' && (
            <div className="h-full overflow-y-auto p-4 pb-20">
                <h2 className="text-lg font-light text-white tracking-[0.2em] uppercase mb-6 pl-2 border-l-2 border-red-500">Graveyard</h2>
                {failedTodos.map(todo => (
                    <TodoItem 
                        key={todo.id} 
                        todo={todo} 
                        onToggle={toggleTodo} 
                        onDelete={deleteTodo} 
                        allTodos={todos}
                        onBuyback={buybackTask}
                        viewContext="list"
                    />
                ))}
            </div>
        )}

        {activeTab === 'archive' && (
            <div className="h-full overflow-y-auto p-4 pb-20">
                <h2 className="text-lg font-light text-white tracking-[0.2em] uppercase mb-6 pl-2 border-l-2 border-slate-500">Deep Storage</h2>
                {archivedTodos.length === 0 && (
                     <div className="text-center text-slate-600 mt-10">
                        <p className="text-xs">No archived tasks found.</p>
                        <p className="text-[10px] text-slate-700 mt-1">Tasks older than 30 days are automatically archived here.</p>
                     </div>
                )}
                {archivedTodos.map(todo => (
                    <TodoItem 
                        key={todo.id} 
                        todo={todo} 
                        onToggle={toggleTodo} 
                        onDelete={deleteTodo} 
                        allTodos={todos}
                        viewContext="list"
                    />
                ))}
            </div>
        )}

        {activeTab === 'notes' && (
            <React.Suspense fallback={<LoadingSpinner />}>
                <NotesView 
                    notes={notes} 
                    todos={todos}
                    onAdd={addNote} 
                    onUpdate={updateNote} 
                    onDelete={deleteNote} 
                    onAddBatch={addBatchTodos}
                />
            </React.Suspense>
        )}

        {activeTab === 'stats' && (
             <React.Suspense fallback={<LoadingSpinner />}>
                 <StatsView todos={todos} />
             </React.Suspense>
        )}

        {activeTab === 'settings' && (
            <React.Suspense fallback={<LoadingSpinner />}>
                <SettingsView 
                    onExport={handleExport} 
                    onImport={handleImport} 
                    onClear={clearAll}
                    onEnableSync={handleEnableSync}
                    onJoinSync={handleJoinSync}
                    onDisconnectSync={handleDisconnectSync}
                    syncStatus={syncStatus}
                />
            </React.Suspense>
        )}
      </div>
    </div>
  );
};

export default TodoList;