import React from 'react';

interface HorizontalResizableHandleProps {
    isTop?: boolean;
}

export const HorizontalResizableHandle: React.FC<HorizontalResizableHandleProps> = ({ isTop = false }) => {
    return (
        <div className={`absolute left-0 w-full h-4 cursor-row-resize flex items-center justify-center group z-10 ${isTop ? '-top-2' : '-bottom-2'}`}>
            <div className="w-16 h-1 bg-accent/50 rounded-full group-hover:bg-primary transition-all duration-200 group-hover:h-1.5"></div>
        </div>
    );
};
