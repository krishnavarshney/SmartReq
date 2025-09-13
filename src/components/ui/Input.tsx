import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', ...props }, ref) => {
        const baseStyles = 'w-full px-3 py-2 glass-surface-lite elev-1 border border-border rounded-md text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring';
        return <input ref={ref} className={`${baseStyles} ${className}`} {...props} />;
    }
);