import React, { useState, useEffect } from 'react';
import { Download, Upload, AlertTriangle, Globe, Cloud, CloudOff, Copy, Check, Loader2, Link, Unlink } from 'lucide-react';
import { 
    generateSyncCode, 
    getSyncState, 
    isSyncEnabled, 
    getCurrentSyncCode,
    getLastSyncedAt 
} from '../services/syncService';

interface SettingsViewProps {
    onExport: () => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
    // Sync props
    onEnableSync?: (code: string) => Promise<boolean>;
    onJoinSync?: (code: string) => Promise<boolean>;
    onDisconnectSync?: () => void;
    syncStatus?: 'disconnected' | 'connecting' | 'connected' | 'error';
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
    onExport, 
    onImport, 
    onClear,
    onEnableSync,
    onJoinSync,
    onDisconnectSync,
    syncStatus = 'disconnected'
}) => {
    const [showSyncSetup, setShowSyncSetup] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Get current sync state
    const currentCode = getCurrentSyncCode();
    const lastSynced = getLastSyncedAt();
    const isConnected = syncStatus === 'connected' || isSyncEnabled();

    const handleGenerateCode = async () => {
        if (!onEnableSync) return;
        
        setIsLoading(true);
        setError(null);
        
        const code = generateSyncCode();
        setGeneratedCode(code);
        
        const success = await onEnableSync(code);
        setIsLoading(false);
        
        if (!success) {
            setError('Failed to create sync room. Please try again.');
            setGeneratedCode(null);
        }
    };

    const handleJoinSync = async () => {
        if (!onJoinSync || !joinCode.trim()) return;
        
        setIsLoading(true);
        setError(null);
        
        const success = await onJoinSync(joinCode.trim().toUpperCase());
        setIsLoading(false);
        
        if (success) {
            setShowSyncSetup(false);
            setJoinCode('');
        } else {
            setError('Sync code not found. Please check and try again.');
        }
    };

    const handleCopyCode = () => {
        const code = generatedCode || currentCode;
        if (code) {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDisconnect = () => {
        if (window.confirm('Disconnect from cloud sync? Your local data will be preserved.')) {
            onDisconnectSync?.();
            setGeneratedCode(null);
            setShowSyncSetup(false);
        }
    };

    const formatLastSynced = (timestamp: number | null) => {
        if (!timestamp) return 'Never';
        const diff = Date.now() - timestamp;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    return (
        <div className="p-6 space-y-8 overflow-y-auto h-full pb-20">
            <div>
                <h2 className="text-xl font-light text-white tracking-[0.2em] mb-1">SYSTEM CONFIG</h2>
                <p className="text-xs text-slate-500 uppercase tracking-widest">Data Management</p>
            </div>

            {/* Cloud Sync Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Cloud size={14} className="text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Cloud Sync</span>
                </div>

                {isConnected && currentCode ? (
                    // Connected State
                    <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-sm font-bold text-emerald-400">Connected</span>
                            </div>
                            <span className="text-[10px] text-slate-500">
                                Last synced: {formatLastSynced(lastSynced)}
                            </span>
                        </div>
                        
                        <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Sync Code</p>
                                <p className="text-lg font-mono font-bold text-cyan-400 tracking-wider">{currentCode}</p>
                            </div>
                            <button 
                                onClick={handleCopyCode}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                title="Copy code"
                            >
                                {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                            </button>
                        </div>
                        
                        <p className="text-[10px] text-slate-500">
                            Enter this code on your other devices to sync data in real-time.
                        </p>
                        
                        <button 
                            onClick={handleDisconnect}
                            className="w-full py-2 flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-red-900/20 border border-slate-700 hover:border-red-500/30 rounded-lg text-slate-400 hover:text-red-400 transition-all text-xs font-bold uppercase tracking-wider"
                        >
                            <Unlink size={14} />
                            Disconnect
                        </button>
                    </div>
                ) : showSyncSetup ? (
                    // Setup State
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
                        {generatedCode ? (
                            // Show generated code
                            <div className="space-y-4">
                                <div className="text-center">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Your Sync Code</p>
                                    <div className="flex items-center justify-center gap-3 bg-slate-900 rounded-lg p-4">
                                        <p className="text-2xl font-mono font-bold text-cyan-400 tracking-wider">{generatedCode}</p>
                                        <button 
                                            onClick={handleCopyCode}
                                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                        >
                                            {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 text-center">
                                    Save this code! Enter it on your other devices to sync.
                                </p>
                                <button 
                                    onClick={() => setShowSyncSetup(false)}
                                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-xs font-bold uppercase tracking-wider transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            // Setup options
                            <>
                                <div className="space-y-3">
                                    <button
                                        onClick={handleGenerateCode}
                                        disabled={isLoading}
                                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 rounded-lg text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Cloud size={16} />
                                        )}
                                        Create New Sync Room
                                    </button>
                                    
                                    <div className="flex items-center gap-3">
                                        <div className="flex-grow h-px bg-slate-700" />
                                        <span className="text-[10px] text-slate-600 uppercase">or</span>
                                        <div className="flex-grow h-px bg-slate-700" />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={joinCode}
                                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                            placeholder="Enter sync code (e.g., STAR-7X9K)"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono tracking-wider text-center"
                                        />
                                        <button
                                            onClick={handleJoinSync}
                                            disabled={isLoading || !joinCode.trim()}
                                            className="w-full py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Link size={16} />
                                            )}
                                            Join Existing Room
                                        </button>
                                    </div>
                                </div>
                                
                                {error && (
                                    <p className="text-xs text-red-400 text-center">{error}</p>
                                )}
                                
                                <button 
                                    onClick={() => {
                                        setShowSyncSetup(false);
                                        setError(null);
                                    }}
                                    className="w-full py-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    // Disconnected State
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-300">Enable Cloud Sync</h3>
                            <p className="text-xs text-slate-500 mt-1">Sync your data across all your devices in real-time.</p>
                        </div>
                        <button 
                            onClick={() => setShowSyncSetup(true)}
                            className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition-colors"
                        >
                            <Cloud size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Existing Data Management Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Download size={14} className="text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Local Backup</span>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-300">Backup Data</h3>
                        <p className="text-xs text-slate-500 mt-1">Download a JSON file of your goals and stats.</p>
                    </div>
                    <button onClick={onExport} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
                        <Download size={20} />
                    </button>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-300">Restore Data</h3>
                        <p className="text-xs text-slate-500 mt-1">Upload a previously exported JSON file.</p>
                    </div>
                    <label className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors cursor-pointer">
                        <Upload size={20} />
                        <input type="file" accept=".json" onChange={onImport} className="hidden" />
                    </label>
                </div>

                <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-4 flex items-center justify-between mt-8">
                    <div>
                        <h3 className="text-sm font-bold text-red-400">System Reset</h3>
                        <p className="text-xs text-red-400/60 mt-1">Permanently delete all data. Irreversible.</p>
                    </div>
                    <button 
                        onClick={() => {
                            if(window.confirm("CRITICAL WARNING: This will wipe all data. Continue?")) {
                                onClear();
                            }
                        }} 
                        className="p-2 bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 rounded-lg text-red-500 transition-colors"
                    >
                        <AlertTriangle size={20} />
                    </button>
                </div>
            </div>
            
            <div className="text-center pt-12 opacity-30">
                <Globe size={48} className="mx-auto mb-4 text-slate-500" strokeWidth={1} />
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">North Star OS v1.1</p>
            </div>
        </div>
    );
};

export default SettingsView;
