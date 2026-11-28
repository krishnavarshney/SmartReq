import React from 'react';

export type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  /** Render a leading icon inside the field. */
  icon?: React.ReactNode;
  invalid?: boolean;
}

const SIZES: Record<InputSize, string> = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-8 px-2.5 text-sm',
  lg: 'h-10 px-3 text-sm',
};

export const inputBaseClass =
  'w-full rounded-md border bg-background text-foreground placeholder:text-muted-foreground/70 ' +
  'transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', size = 'md', icon, invalid, ...props }, ref) => {
    const borderClass = invalid ? 'border-destructive focus:border-destructive focus:ring-destructive/25' : 'border-input';
    const field = (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`${inputBaseClass} ${borderClass} ${SIZES[size]} ${icon ? '!pl-8' : ''} ${className}`}
        {...props}
      />
    );
    if (!icon) return field;
    return (
      <div className="relative w-full">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        {field}
      </div>
    );
  }
);
Input.displayName = 'Input';
