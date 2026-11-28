import React from 'react';

interface KPICardProps {
  title: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  /** Optional element in the top-right corner (icon, badge). */
  children?: React.ReactNode;
  className?: string;
}

/** Compact stat tile: label, headline number, one line of context. */
export const KPICard: React.FC<KPICardProps> = ({ title, value, description, children, className = '' }) => (
  <div className={`min-w-0 rounded-lg border border-border bg-card px-3 py-2.5 ${className}`}>
    <div className="flex items-center justify-between gap-2">
      <h3 className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
    <p className="mt-1 truncate font-mono text-lg font-semibold tabular-nums leading-6 text-foreground">{value}</p>
    {description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>}
  </div>
);
