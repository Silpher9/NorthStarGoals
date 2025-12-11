import React, { useState } from 'react';
import { Routine, Frequency } from '../types';
import { Rocket, Calendar, Repeat, CheckSquare, Plus, Trash2, X, Activity, Zap, Flame } from 'lucide-react';

interface RoutineManagerProps {
    routines: Routine[];
    onAdd: (routine: Omit<Routine, 'id' | 'createdAt' | 'lastGeneratedDate' | 'completedCycles' | 'streak'>) => void;
    onDelete: (id: string) => void;
}

const RoutineManager: React.FC<RoutineManagerProps> = ({ routines, onAdd, onDelete }) => {
    const [isAdding, setIsAdding] = useState(false);
    
    // Form State
    const [title, setTitle] = useState('');
    const [label, setLabel] = useState('');
    const [frequency, setFrequency] = useState<Frequency>('weekly');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [selectedDate, setSelectedDate] = useState<number>(1);
    const [targetCycles, setTargetCycles] = useState<number>(4);

    const toggleDay = (day: number) => {
        setSelectedDays(prev => 
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        if ((frequency === 'weekly' || frequency === 'biweekly') && selectedDays.length === 0) return;

        onAdd({
            title: title.trim(),
            label: label.trim() || undefined,
            frequency,
            daysOfWeek: selectedDays,
            dayOfMonth: selectedDate,
            targetCycles,
            color: 'cyan'
        });

        // Reset
        setTitle('');
        setLabel('');
        setSelectedDays([]);
        setIsAdding(false);
    };

    const renderDaySelector = () => {
        const days = [
            { label: 'M', val: 1 },
            { label: 'T', val: 2 },
            { label: 'W', val: 3 },
            { label: 'T', val: 4 },
            { label: 'F', val: 5 },
            { label: 'S', val: 6 },
            { label: 'S', val: 0 },
        ];
        return (
            <div className="flex gap-2 justify-center my-4">
                {days.map(d => (
                    <button
                        key={d.val}
                        type="button"
                        onClick={() => toggleDay(d.val)}
                        className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border
                            ${selectedDays.includes(d.val) 
                                ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]' 
                                : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500'}
                        `}
                    >
                        {d.label}
                    </button>
                ))}
            </div>
        );
    };

    const getVelocityStyles = (streak: number) => {
        if (streak >= 12) return { 
            borderColor: 'border-rose-500', 
            shadow: 'shadow-rose-900/20', 
            text: 'text-rose-400',
            bg: 'bg-rose-900/10',
            label: 'MACH 3' 
        };
        if (streak >= 6) return { 
            borderColor: 'border-purple-500', 
            shadow: 'shadow-purple-900/20', 
            text: 'text-purple-400', 
            bg: 'bg-purple-900/10',
            label: 'MACH 2' 
        };
        if (streak >= 2) return { 
            borderColor: 'border-cyan-500', 
            shadow: 'shadow-cyan-900/20', 
            text: 'text-cyan-400', 
            bg: 'bg-cyan-900/10',
            label: 'MACH 1' 
        };
        return { 
            borderColor: 'border-slate-700/50', 
            shadow: 'shadow-none', 
            text: 'text-slate-500', 
            bg: 'bg-slate-800/40',
            label: 'SUB-ORBITAL' 
        };
    };

    return (
        <div className="mb-8 pt-8 border-t border-slate-800">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Activity size={16} className="text-cyan-400" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Orbital Flight Patterns</h2>
                </div>
                {!isAdding && (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="p-2 text-cyan-400 hover:bg-cyan-900/20 rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                    </button>
                )}
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-4 mb-6 shadow-2xl relative overflow-hidden">
                     {/* Decorative Header */}
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-transparent opacity-50" />
                     
                     <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">New Flight Pattern</h3>
                        <button type="button" onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
                     </div>

                     {/* Name & Label */}
                     <div className="space-y-3 mb-4">
                        <input 
                            type="text" 
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Routine Name (e.g. Morning Jog)" 
                            className="w-full bg-slate-800 border-b border-slate-600 focus:border-cyan-500 px-3 py-2 text-sm text-white focus:outline-none placeholder-slate-500 transition-colors"
                            autoFocus
                        />
                         <input 
                            type="text" 
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            placeholder="Label (Optional)" 
                            className="w-full bg-transparent border-b border-slate-700 focus:border-cyan-500/50 px-3 py-1 text-xs text-slate-400 focus:outline-none placeholder-slate-600"
                        />
                     </div>

                     {/* Orbit Selector */}
                     <div className="grid grid-cols-3 gap-1 bg-slate-800 rounded-lg p-1 mb-4">
                        {(['weekly', 'biweekly', 'monthly'] as const).map(f => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFrequency(f)}
                                className={`
                                    py-2 rounded text-[9px] font-bold uppercase tracking-wider transition-all
                                    ${frequency === f ? 'bg-cyan-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}
                                `}
                            >
                                {f === 'weekly' ? 'Low Orbit' : f === 'biweekly' ? 'High Orbit' : 'Deep Space'}
                            </button>
                        ))}
                     </div>

                     {/* Triggers */}
                     <div className="mb-4">
                        <p className="text-[10px] text-slate-500 uppercase font-bold text-center mb-1">
                            {frequency === 'monthly' ? 'Launch Date' : 'Active Days'}
                        </p>
                        
                        {frequency === 'monthly' ? (
                            <div className="flex justify-center">
                                <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg border border-slate-700">
                                    <Calendar size={14} className="text-cyan-500" />
                                    <select 
                                        value={selectedDate} 
                                        onChange={e => setSelectedDate(Number(e.target.value))}
                                        className="bg-transparent text-white text-sm font-bold focus:outline-none"
                                    >
                                        {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                                            <option key={d} value={d}>{d}{[1, 21, 31].includes(d) ? 'st' : [2, 22].includes(d) ? 'nd' : [3, 23].includes(d) ? 'rd' : 'th'}</option>
                                        ))}
                                    </select>
                                    <span className="text-xs text-slate-400">of every month</span>
                                </div>
                            </div>
                        ) : (
                            renderDaySelector()
                        )}
                        {frequency === 'biweekly' && (
                            <p className="text-[9px] text-cyan-400/70 text-center mt-1">
                                * Starts this week, then skips every other week.
                            </p>
                        )}
                     </div>

                     {/* Commitment (Numerical Checkboxes) */}
                     <div className="mb-6">
                        <p className="text-[10px] text-slate-500 uppercase font-bold text-center mb-3">
                            Mission Commitment ({frequency === 'weekly' ? 'Weeks' : frequency === 'biweekly' ? 'Cycles' : 'Months'})
                        </p>
                        <div className="flex justify-between px-2">
                             {[1, 2, 4, 6, 8, 12, 24].map(num => (
                                 <label key={num} className="cursor-pointer group flex flex-col items-center gap-1">
                                     <input 
                                        type="radio" 
                                        name="cycles" 
                                        checked={targetCycles === num} 
                                        onChange={() => setTargetCycles(num)}
                                        className="hidden"
                                     />
                                     <div className={`
                                        w-8 h-8 rounded border flex items-center justify-center text-xs font-bold transition-all
                                        ${targetCycles === num 
                                            ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]' 
                                            : 'bg-slate-800 border-slate-700 text-slate-500 group-hover:border-slate-500'}
                                     `}>
                                        {num}
                                     </div>
                                 </label>
                             ))}
                        </div>
                     </div>

                     <button 
                        type="submit"
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-cyan-900/20"
                     >
                        Initialize Pattern
                     </button>
                </form>
            )}

            {/* List Routines */}
            <div className="space-y-3">
                {routines.map(routine => {
                    const streak = routine.streak || 0;
                    const vStyle = getVelocityStyles(streak);
                    
                    return (
                        <div key={routine.id} className={`group relative ${vStyle.bg} border ${vStyle.borderColor} rounded-xl p-4 transition-all hover:bg-slate-800/60 shadow-lg ${vStyle.shadow}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Repeat size={12} className={vStyle.text} />
                                        {routine.title}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        {routine.label && (
                                            <span className="text-[9px] uppercase font-bold text-cyan-200/60 bg-cyan-900/20 px-1.5 py-0.5 rounded">
                                                {routine.label}
                                            </span>
                                        )}
                                        <span className={`text-[9px] uppercase tracking-wide font-bold ${vStyle.text} flex items-center gap-1`}>
                                            <Flame size={8} className="fill-current" />
                                            {vStyle.label} ({streak})
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onDelete(routine.id)}
                                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            {/* Progress Bar (Habit Builder) */}
                            <div className="mt-3">
                                <div className="flex justify-between text-[9px] text-slate-500 mb-1 uppercase font-bold">
                                    <span>Frequency</span>
                                    <span>
                                        {routine.frequency === 'monthly' 
                                            ? `Day ${routine.dayOfMonth}` 
                                            : routine.daysOfWeek.map(d => ['S','M','T','W','T','F','S'][d]).join(' ')}
                                    </span>
                                </div>
                                <div className="flex gap-1 h-1.5 mt-2">
                                    {Array.from({length: routine.targetCycles}).map((_, i) => {
                                        const isComplete = i < routine.completedCycles;
                                        return (
                                            <div 
                                                key={i}
                                                className={`
                                                    flex-1 rounded-sm transition-all duration-500
                                                    ${isComplete ? `bg-current ${vStyle.text} opacity-80` : 'bg-slate-800'}
                                                `}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {routines.length === 0 && !isAdding && (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
                        <Rocket size={24} className="mx-auto text-slate-700 mb-2" />
                        <p className="text-xs text-slate-500">No active flight patterns.</p>
                        <button onClick={() => setIsAdding(true)} className="text-[10px] text-cyan-500 font-bold uppercase mt-2 hover:underline">
                            Establish new routine
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoutineManager;