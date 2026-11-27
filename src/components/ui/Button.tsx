import React from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'subtle';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE =
  'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium select-none ' +
  'transition-[background-color,border-color,color,box-shadow,opacity] duration-150 motion-base focus-ring ' +
  'disabled:opacity-50 disabled:pointer-events-none active:translate-y-px [&_svg]:shrink-0';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/0.12),0_1px_2px_0_rgb(0_0_0/0.2)] hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:border-input',
  outline: 'bg-transparent text-foreground border border-input hover:bg-accent',
  ghost: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  subtle: 'bg-primary/10 text-primary hover:bg-primary/15',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5',
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-sm',
  lg: 'h-10 px-4 text-sm',
};

const ICON_SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, isLoading = false, variant = 'primary', size = 'md', className = '', type = 'button', disabled, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={isLoading || disabled}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

/** Square icon-only button. Always pass an `aria-label`. */
export const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className = '', variant = 'ghost', size = 'md', isLoading, ...props }, ref) => (
    <Button ref={ref} variant={variant} size={size} isLoading={isLoading} className={`!px-0 ${ICON_SIZES[size]} ${className}`} {...props}>
      {isLoading ? null : children}
    </Button>
  )
);
IconButton.displayName = 'IconButton';
