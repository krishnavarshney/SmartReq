import React from 'react';
import { inputBaseClass } from './Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className = '', invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={`${inputBaseClass} ${invalid ? 'border-destructive' : 'border-input'} min-h-[80px] px-2.5 py-2 text-sm ${className}`}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
