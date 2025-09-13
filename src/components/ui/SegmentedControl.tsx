import React from 'react';
import { motion } from 'framer-motion';

interface SegmentedControlProps {
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, value, onChange }) => {
    return (
        <div className="flex items-center border-b border-border flex-shrink-0 h-10">
            {options.map((option, index) => (
                <button 
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`relative flex items-center justify-center h-full text-sm font-semibold transition-colors duration-200 
                        ${index < options.length - 1 ? 'border-r border-border' : ''}
                        ${value === option.value 
                            ? 'text-primary' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
                        }
                    `}
                >
                    {option.label}
                    {value === option.value && (
                        <motion.div
                            layoutId="active-segmented-control-background"
                            className="absolute inset-0 bg-card border-b-2 border-primary"
                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                    )}
                </button>
            ))}
        </div>
    );
};
