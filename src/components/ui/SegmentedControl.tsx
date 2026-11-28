import React, { useId } from 'react';
import { motion } from 'framer-motion';

interface SegmentedControlProps {
  options: { value: string; label: React.ReactNode; icon?: React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, value, onChange, size = 'md', className = '', ...rest }) => {
  const id = useId();
  const h = size === 'sm' ? 'h-6 text-xs px-2' : 'h-7 text-[13px] px-2.5';
  return (
    <div role="radiogroup" aria-label={rest['aria-label']} className={`inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5 ${className}`}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`relative flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus-ring ${h} ${
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md bg-card shadow-[0_1px_2px_rgb(0_0_0/0.15)] ring-1 ring-border"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            {option.icon && <span className="relative z-10 flex [&_svg]:h-3.5 [&_svg]:w-3.5">{option.icon}</span>}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
