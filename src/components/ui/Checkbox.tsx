import React from 'react';
import { Check } from '../icons';

interface CheckboxProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    className?: string;
    'aria-label'?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onCheckedChange, className = '', ...props }) => {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => onCheckedChange(!checked)}
            className={`
                h-4 w-4 rounded-sm border-2 transition-colors flex items-center justify-center flex-shrink-0
                ${checked 
                    ? 'bg-primary border-primary' 
                    : 'bg-surface border-border hover:border-primary'}
                focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
                ${className}
            `}
            {...props}
        >
            <div className={`transition-transform duration-200 ease-in-out ${checked ? 'scale-100' : 'scale-0'}`}>
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </div>
        </button>
    );
};