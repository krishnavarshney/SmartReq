import React from 'react';

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/** Native range input styled with the design tokens (keyboard and screen-reader friendly). */
export const Slider: React.FC<SliderProps> = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  disabled,
  id,
  ...aria
}) => {
  const percentage = Math.max(0, Math.min(100, ((value[0] - min) / (max - min)) * 100));

  return (
    <div className={`relative flex h-5 w-full items-center ${disabled ? 'opacity-50' : ''} ${className}`}>
      <div className="pointer-events-none absolute h-1 w-full rounded-full bg-muted ring-1 ring-inset ring-border">
        <div className="absolute h-1 rounded-full bg-primary" style={{ width: `${percentage}%` }} />
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        disabled={disabled}
        onChange={(e) => onValueChange([parseFloat(e.target.value)])}
        {...aria}
        className="relative h-5 w-full cursor-pointer appearance-none bg-transparent focus:outline-none disabled:cursor-not-allowed
                   [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-solid
                   [&::-webkit-slider-thumb]:border-card [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]
                   [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2
                   [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-card [&::-moz-range-thumb]:bg-primary
                   focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-ring
                   focus-visible:[&::-webkit-slider-thumb]:ring-offset-2 focus-visible:[&::-webkit-slider-thumb]:ring-offset-background"
      />
    </div>
  );
};
