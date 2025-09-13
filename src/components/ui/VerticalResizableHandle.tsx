import React from 'react';

export const VerticalResizableHandle: React.FC = () => {
    return (
        <div className="absolute -right-2 top-0 h-full w-4 cursor-col-resize flex items-center justify-center group z-10">
            <div className="h-16 w-1 bg-accent/50 rounded-full group-hover:bg-primary transition-all duration-200 group-hover:w-1.5"></div>
        </div>
    );
};
