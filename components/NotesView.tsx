import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, StickyNote, Trash2, Pencil, Sparkles, Clock, Tag, Plus, X, Loader2 } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { Todo, Note } from '../types';
import { generateTasksFromNote } from '../services/geminiService';

const NoteInputForm: React.FC<{ onAdd: (text: string, label?: string) => void }> = ({ onAdd }) => {
    const [input, setInput] = useState('');
    const [label, setLabel] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onAdd(input, label.trim());
            setInput('');
            setLabel('');
        }
    };

    return (
        <div className="mt-4 bg-slate-800 p-3 rounded-xl border border-indigo-500/30">
            <div className="mb-2 flex items-center gap-2 border-b border-slate-700 pb-2">
                <Tag size={12} className="text-slate-500" />
                <input 
                    type="text"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="Label (optional)..."
                    className="bg-transparent text-xs text-white w-full focus:outline-none placeholder-slate-500"
                />
            </div>
            <RichTextEditor 
                value={input} 
                onChange={setInput} 
                placeholder="Capture thoughts..." 
                minHeight="80px"
                className="border-none bg-slate-900/50"
            />
            <div className="flex justify-end mt-2">
                <button 
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg disabled:opacity-50 transition-all"
                >
                    Save Note
                </button>
            </div>
        </div>
    );
};

const NoteItem: React.FC<{ 
    note: Note, 
    onDelete: (id: string) => void, 
    onUpdate: (id: string, text: string) => void,
    onConvert: (note: Note) => void
}> = React.memo(({ note, onDelete, onUpdate, onConvert }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(note.text);

    const handleSave = () => {
        if (editValue.trim() !== note.text) {
            onUpdate(note.id, editValue);
        }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="bg-indigo-900/10 p-4 rounded-xl border border-indigo-500/40">
                <RichTextEditor value={editValue} onChange={setEditValue} minHeight="100px" />
                <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs text-slate-400 hover:text-white font-medium">Cancel</button>
                    <button onClick={handleSave} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 font-medium">Save</button>
                </div>
            </div>
        );
    }

    return (
        <div className="group bg-indigo-900/10 hover:bg-indigo-900/20 border border-indigo-500/20 hover:border-indigo-500/40 p-4 rounded-xl transition-all relative">
             {note.label && (
                <div className="mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {String(note.label)}
                    </span>
                </div>
             )}
             <div 
                className="pr-8 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5"
                dangerouslySetInnerHTML={{ __html: String(note.text || '') }}
             />
             <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                   onClick={() => onConvert(note)}
                   className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-900/20 rounded-lg"
                   title="Convert to Task(s)"
                >
                   <Sparkles size={14} /> 
                </button>
                <button 
                   onClick={() => setIsEditing(true)}
                   className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-900/20 rounded-lg"
                   title="Edit Note"
                >
                   <Pencil size={14} /> 
                </button>
                <button 
                   onClick={() => onDelete(note.id)}
                   className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg"
                   title="Delete Note"
                >
                   <Trash2 size={14} />
                </button>
             </div>
             <div className="flex items-center gap-1.5 text-[10px] text-slate-600 mt-2 font-mono">
                 <Clock size={10} />
                 {new Date(note.createdAt).toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
             </div>
        </div>
    );
});

interface NotesViewProps {
    notes: Note[];
    todos: Todo[];
    onAdd: (text: string, label?: string) => void;
    onUpdate: (id: string, text: string) => void;
    onDelete: (id: string) => void;
    onAddBatch: (tasks: string[], parentId?: string) => void;
}

const NotesView: React.FC<NotesViewProps> = ({ notes, todos, onAdd, onUpdate, onDelete, onAddBatch }) => {
    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

    // Conversion Modal State
    const [convertingNote, setConvertingNote] = useState<Note | null>(null);
    const [convertStep, setConvertStep] = useState<'destination' | 'review'>('destination');
    const [targetParentId, setTargetParentId] = useState<string>('root');
    const [generatedTasks, setGeneratedTasks] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Unique labels logic
    const uniqueLabels = useMemo(() => Array.from(new Set(notes.map(n => String(n.label || 'Unlabeled')))), [notes]);

    // Initialize selected labels
    useEffect(() => {
        setSelectedLabels(prev => {
             const newLabels = uniqueLabels.filter(l => !prev.includes(l));
             if (newLabels.length > 0) return [...prev, ...newLabels];
             return prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uniqueLabels.length]); // Depend on length to avoid loops

    const toggleLabel = (lbl: string) => {
        setSelectedLabels(prev => 
            prev.includes(lbl) ? prev.filter(l => l !== lbl) : [...prev, lbl]
        );
    };

    // Filter Logic
    const filteredNotes = useMemo(() => notes.filter(n => {
        const matchesSearch = n.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (n.label && n.label.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const noteLabel = n.label || 'Unlabeled';
        const matchesLabel = selectedLabels.includes(noteLabel);
        
        return matchesSearch && matchesLabel;
    }).sort((a,b) => b.createdAt - a.createdAt), [notes, searchTerm, selectedLabels]);

    // AI Conversion Handlers
    const startConversion = useCallback((note: Note) => {
        setConvertingNote(note);
        setConvertStep('destination');
        setTargetParentId('root');
        setGeneratedTasks([]);
    }, []);

    const handleGenerate = async () => {
        if (!convertingNote) return;
        setIsGenerating(true);
        
        try {
            // Ensure content is strictly a string to satisfy API requirements
            const content = String(convertingNote.text || '');
            
            const tasks = await generateTasksFromNote(content);
            
            if (tasks && Array.isArray(tasks)) {
                // Ensure explicit string array
                const safeTasks: string[] = tasks.map(t => String(t));
                setGeneratedTasks(safeTasks);
                setConvertStep('review');
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Error generating tasks:", errorMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    const confirmConversion = () => {
        if (generatedTasks.length > 0) {
            onAddBatch(generatedTasks, targetParentId === 'root' ? undefined : targetParentId);
        }
        setConvertingNote(null);
    };

    const removeGeneratedTask = (index: number) => {
        setGeneratedTasks(prev => prev.filter((_, i) => i !== index));
    };

    const updateGeneratedTask = (index: number, val: string) => {
        setGeneratedTasks(prev => prev.map((t, i) => i === index ? val : t));
    };
    
    const addManualTask = () => {
        setGeneratedTasks(prev => [...prev, 'New Task']);
    };

    // Data for Destination Select
    const goals = useMemo(() => todos.filter(t => t.label === 'goal' && t.status !== 'graveyard'), [todos]);
    const activeTasks = useMemo(() => todos.filter(t => t.label === 'normal' && t.status !== 'graveyard' && !t.completed), [todos]);

    return (
        <div className="h-full flex flex-col p-4 bg-slate-900/50 relative">
            {/* Header / Filters */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <StickyNote className="text-indigo-400" />
                    <h2 className="text-lg font-bold uppercase tracking-widest text-slate-300">Field Notes</h2>
                </div>
                
                <div className="flex gap-2">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search notes..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>

                {uniqueLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {uniqueLabels.map(lbl => (
                            <button
                                key={lbl}
                                onClick={() => toggleLabel(lbl)}
                                className={`
                                    px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all
                                    ${selectedLabels.includes(lbl) 
                                        ? 'bg-indigo-600 border-indigo-500 text-white' 
                                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}
                                `}
                            >
                                {lbl}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Notes List */}
            <div className="flex-grow overflow-y-auto space-y-4 pb-20 pr-1">
                {filteredNotes.length === 0 ? (
                    <div className="text-center text-slate-600 mt-10">
                        <p>No notes found.</p>
                    </div>
                ) : (
                    filteredNotes.map(note => (
                        <NoteItem key={note.id} note={note} onDelete={onDelete} onUpdate={onUpdate} onConvert={startConversion} />
                    ))
                )}
            </div>

            {/* Input Area */}
            <NoteInputForm onAdd={onAdd} />

            {/* AI Conversion Modal */}
            {convertingNote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#0f172a] border border-emerald-500/30 rounded-2xl max-w-lg w-full shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-emerald-500/20 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-emerald-400 animate-pulse" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                                    {convertStep === 'destination' ? 'Target Designation' : 'Tactical Review'}
                                </h3>
                            </div>
                            <button onClick={() => setConvertingNote(null)} className="text-slate-500 hover:text-white"><X size={18} /></button>
                        </div>

                        <div className="p-6 flex-grow overflow-y-auto">
                            {convertStep === 'destination' ? (
                                <div className="space-y-6">
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 text-slate-400 text-xs italic line-clamp-3">
                                        "{String(convertingNote.text || '').replace(/<[^>]*>?/gm, '')}"
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-slate-400 block">Assign Target Orbit</label>
                                        <select 
                                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-3 focus:outline-none focus:border-emerald-500"
                                            value={targetParentId}
                                            onChange={(e) => setTargetParentId(e.target.value)}
                                        >
                                            <option value="root">Standard Orbit (No Parent)</option>
                                            <optgroup label="Primary Goals">
                                                {goals.map(g => (
                                                    <option key={g.id} value={g.id}>
                                                        {g.goalCategory?.toUpperCase()} - {g.text}
                                                    </option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Active Tasks">
                                                {activeTasks.map(t => (
                                                    <option key={t.id} value={t.id}>{t.text}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        <p className="text-[10px] text-slate-500">
                                            Select where the generated tasks should be created.
                                        </p>
                                    </div>

                                    <button 
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="w-full py-3 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-400 rounded-xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                                    >
                                        {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                        {isGenerating ? 'Analyzing Intelligence...' : 'Generate Action Items'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-xs text-slate-500 uppercase font-bold">
                                        <span>Action Items</span>
                                        <button onClick={addManualTask} className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                                            <Plus size={12} /> Add
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {generatedTasks.length === 0 ? (
                                            <div className="text-center p-4 text-slate-500 italic text-xs">No actionable tasks found. Add one manually.</div>
                                        ) : (
                                            generatedTasks.map((task, idx) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <div className="flex-grow bg-slate-800/50 rounded-lg border border-slate-700 flex items-center px-3">
                                                        <input 
                                                            type="text" 
                                                            value={task}
                                                            onChange={(e) => updateGeneratedTask(idx, e.target.value)}
                                                            className="bg-transparent w-full py-2 text-sm text-white focus:outline-none"
                                                        />
                                                    </div>
                                                    <button onClick={() => removeGeneratedTask(idx)} className="text-slate-600 hover:text-red-400 p-2">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {convertStep === 'review' && (
                            <div className="p-4 border-t border-slate-800 flex gap-3">
                                <button 
                                    onClick={() => setConvertStep('destination')}
                                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider"
                                >
                                    Back
                                </button>
                                <button 
                                    onClick={confirmConversion}
                                    disabled={generatedTasks.length === 0}
                                    className="flex-grow px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                                >
                                    Confirm & Create
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotesView;