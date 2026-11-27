import React from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, isLoading = false, variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    const baseStyles = 'relative inline-flex items-center justify-center rounded-md font-semibold focus-ring transition-all motion-base disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';

    const variantStyles = {
      primary: 'bg-gradient-to-r from-[hsl(var(--primary))] to-violet-600 text-primary-foreground elev-1 hover:elev-2 hover:shadow-primary/25 hover:-translate-y-[1px]',
      secondary: 'bg-secondary text-secondary-foreground elev-0 hover:bg-accent hover:elev-1 hover:-translate-y-[1px]',
      ghost: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      destructive: 'bg-destructive text-destructive-foreground elev-0 hover:bg-destructive/90 hover:elev-1 hover:-translate-y-[1px]',
      outline: 'bg-transparent text-foreground border border-border hover:bg-accent hover:text-accent-foreground',
    };

    const sizeStyles = {
      sm: 'px-3 h-8 text-xs',
      md: 'px-4 h-9 text-sm',
      lg: 'px-6 h-11 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && <Spinner className="mr-2 h-4 w-4" />}
        {children}
      </button>
    );
  }
);

export const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={`!px-0 w-9 h-9 ${className}`}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
