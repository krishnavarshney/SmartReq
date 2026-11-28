import React from 'react';

/** Column-resize grip for re-resizable (a thin line that highlights on hover). */
export const VerticalResizableHandle: React.FC = () => (
  <div className="group absolute -right-1 top-0 z-10 flex h-full w-2 cursor-col-resize justify-center">
    <div className="h-full w-px bg-transparent transition-colors duration-150 group-hover:bg-primary group-active:bg-primary" />
  </div>
);
