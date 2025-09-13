import React from 'react';

export const ResponsePanelSkeleton: React.FC = () => {
  const Shimmer: React.FC = () => <div className="absolute inset-0 bg-gradient-to-r from-transparent via-card/50 to-transparent animate-shimmer" />;

  return (
    <div className="h-full flex flex-col p-4 space-y-4 animate-pulse">
        <div className="flex justify-between items-center h-14">
            <div className="h-6 w-1/4 bg-muted rounded-md relative overflow-hidden"><Shimmer/></div>
            <div className="flex gap-2">
                <div className="h-6 w-24 bg-muted rounded-md relative overflow-hidden"><Shimmer/></div>
                <div className="h-6 w-24 bg-muted rounded-md relative overflow-hidden"><Shimmer/></div>
            </div>
        </div>
        <div className="flex gap-2 border-b border-border pb-2">
            <div className="h-8 w-20 bg-muted rounded-md relative overflow-hidden"><Shimmer/></div>
            <div className="h-8 w-24 bg-muted rounded-md relative overflow-hidden"><Shimmer/></div>
            <div className="h-8 w-24 bg-muted rounded-md relative overflow-hidden"><Shimmer/></div>
        </div>
        <div className="flex-grow bg-muted rounded-md relative overflow-hidden"><Shimmer/></div>
    </div>
  );
};
