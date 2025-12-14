import React from 'react';

declare const __APP_VERSION__: string;

const VersionBadge: React.FC = () => {
  return (
    <div className="fixed bottom-2 right-2 z-50">
      <span className="text-[10px] text-slate-500/50 font-mono tracking-wider hover:text-slate-400/70 transition-colors">
        v{__APP_VERSION__}
      </span>
    </div>
  );
};

export default VersionBadge;
