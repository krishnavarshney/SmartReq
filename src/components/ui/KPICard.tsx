import React from 'react';

interface KPICardProps {
  title: string;
  value: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, description, children, className }) => {
  return (
    <div className={`bg-card/70 backdrop-blur-sm p-4 rounded-lg border border-border motion-base elev-0 hover:elev-1 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {children}
      </div>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  );
};
