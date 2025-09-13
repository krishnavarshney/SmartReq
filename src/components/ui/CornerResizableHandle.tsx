import React from 'react';

export const CornerResizableHandle: React.FC = () => {
    return (
        <div className="absolute -bottom-2 -right-2 w-4 h-4 cursor-nwse-resize group z-20 flex items-center justify-center">
            <div className="w-3 h-3 transition-all duration-200 group-hover:scale-125">
                <div className="w-1 h-3 bg-border rounded-full absolute right-0 bottom-0 group-hover:bg-primary"></div>
                <div className="w-3 h-1 bg-border rounded-full absolute right-0 bottom-0 group-hover:bg-primary"></div>
            </div>
        </div>
    );
};
