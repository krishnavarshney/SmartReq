import React from 'react';

interface HorizontalResizableHandleProps {
  isTop?: boolean;
}

/** Row-resize grip for re-resizable (a thin line that highlights on hover). */
export const HorizontalResizableHandle: React.FC<HorizontalResizableHandleProps> = ({ isTop = false }) => (
  <div className={`group absolute left-0 z-10 flex h-2 w-full cursor-row-resize items-center ${isTop ? '-top-1' : '-bottom-1'}`}>
    <div className="h-px w-full bg-transparent transition-colors duration-150 group-hover:bg-primary group-active:bg-primary" />
  </div>
);
