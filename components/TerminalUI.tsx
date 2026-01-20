import React from 'react';

interface TerminalPanelProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  children,
  title,
  className = ''
}) => {
  return (
    <div className={`border border-gray-600 bg-gray-900 p-3 ${className}`}>
      {title && (
        <div className="mb-2 text-green-400 font-mono text-sm border-b border-gray-600 pb-1">
          {title}
        </div>
      )}
      <div className="text-gray-300 font-mono text-xs">
        {children}
      </div>
    </div>
  );
};

interface BlinkingCursorProps {
  className?: string;
}

export const BlinkingCursor: React.FC<BlinkingCursorProps> = ({
  className = ''
}) => {
  return (
    <span className={`inline-block w-2 h-4 bg-green-400 animate-pulse ${className}`}>
      &nbsp;
    </span>
  );
};

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  children,
  className = ''
}) => {
  const statusColors = {
    online: 'text-green-400',
    offline: 'text-gray-400',
    warning: 'text-yellow-400',
    error: 'text-red-400'
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-mono border ${statusColors[status]} border-current ${className}`}>
      {children}
    </span>
  );
};