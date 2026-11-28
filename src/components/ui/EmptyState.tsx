import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** compact: for small panels and table bodies. */
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, children, className = '', compact = false }) => (
  <div className={`flex h-full flex-col items-center justify-center text-center animate-fade-in ${compact ? 'gap-1.5 p-4' : 'gap-2 p-8'} ${className}`}>
    {icon && (
      <div
        className={`mb-1 flex items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground ${
          compact ? 'h-9 w-9 [&_svg]:h-4 [&_svg]:w-4' : 'h-12 w-12 [&_svg]:h-5 [&_svg]:w-5'
        }`}
      >
        {icon}
      </div>
    )}
    {title && <h3 className={`font-semibold text-foreground ${compact ? 'text-[13px]' : 'text-sm'}`}>{title}</h3>}
    <p className={`max-w-sm text-muted-foreground ${compact ? 'text-xs' : 'text-[13px]'}`}>{message}</p>
    {children && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{children}</div>}
  </div>
);
