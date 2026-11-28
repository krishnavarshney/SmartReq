import React from 'react';
import { Check } from '../icons';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onCheckedChange, className = '', disabled, ...props }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onCheckedChange(!checked)}
    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors focus-ring disabled:opacity-40 ${
      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:border-muted-foreground'
    } ${className}`}
    {...props}
  >
    <Check className={`h-3 w-3 transition-transform duration-150 ${checked ? 'scale-100' : 'scale-0'}`} strokeWidth={3} />
  </button>
);
