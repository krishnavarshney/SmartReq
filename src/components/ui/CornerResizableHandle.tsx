import React from 'react';

/** Corner grip for re-resizable. */
export const CornerResizableHandle: React.FC = () => (
  <div className="group absolute -bottom-1 -right-1 z-20 h-3 w-3 cursor-nwse-resize">
    <div className="absolute bottom-1 right-1 h-1.5 w-1.5 border-b border-r border-border transition-colors duration-150 group-hover:border-primary" />
  </div>
);
