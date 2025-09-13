import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, children }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center animate-fade-in">
      {icon}
      {title && <h3 className="text-lg font-semibold text-foreground mt-4">{title}</h3>}
      <p className="text-sm mt-1">{message}</p>
      {children}
    </div>
  );
};
