import React from 'react';

export const TerminalPanel: React.FC<{ 
  title: string; 
  children: React.ReactNode; 
  className?: string;
  headerAction?: React.ReactNode;
  noPadding?: boolean;
}> = ({ title, children, className = '', headerAction, noPadding = false }) => {
  return (
    <div className={`flex flex-col border border-[#333] bg-[#09090b] overflow-hidden ${className}`}>
      <div className="flex items-center justify-between bg-[#111] px-2 py-1 border-b border-[#333] shrink-0">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#ff9900] select-none">
          {`// ${title}`}
        </h3>
        {headerAction && <div>{headerAction}</div>}
      </div>
      <div className={`flex-1 overflow-auto relative ${noPadding ? '' : 'p-2'}`}>
        {children}
      </div>
    </div>
  );
};

export const BlinkingCursor = () => (
  <span className="inline-block w-1.5 h-3 bg-[#ff9900] animate-pulse align-middle ml-1" />
);

export const StatusBadge: React.FC<{ level: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL' }> = ({ level }) => {
  const colors = {
    LOW: 'text-green-500 border-green-900 bg-green-900/10',
    MED: 'text-yellow-500 border-yellow-900 bg-yellow-900/10',
    HIGH: 'text-orange-500 border-orange-900 bg-orange-900/10',
    CRITICAL: 'text-red-500 border-red-900 bg-red-900/10 animate-pulse',
  };

  return (
    <span className={`text-[9px] px-1 py-px border ${colors[level]} font-mono font-bold uppercase`}>
      {level}
    </span>
  );
};

export const GlitchText: React.FC<{ text: string }> = ({ text }) => {
    return <span className="glow-text tracking-tight">{text}</span>;
}