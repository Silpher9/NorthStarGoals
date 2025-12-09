import React from 'react';
import { Download, Upload, AlertTriangle, Globe } from 'lucide-react';

interface SettingsViewProps {
    onExport: () => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onExport, onImport, onClear }) => {
    return (
        <div className="p-6 space-y-8">
            <div>
                <h2 className="text-xl font-light text-white tracking-[0.2em] mb-1">SYSTEM CONFIG</h2>
                <p className="text-xs text-slate-500 uppercase tracking-widest">Data Management</p>
            </div>

            <div className="space-y-4">
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
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">North Star OS v1.0</p>
            </div>
        </div>
    );
};

export default SettingsView;