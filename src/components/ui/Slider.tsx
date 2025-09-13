import React from 'react';

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
}) => {
  const percentage = ((value[0] - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange([parseFloat(e.target.value)]);
  };

  return (
    <div className={`relative flex items-center w-full group ${className}`}>
      <div className="absolute h-1.5 w-full bg-surface-muted rounded-full">
        <div
          className="absolute h-1.5 bg-primary rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={handleChange}
        className="w-full h-1.5 bg-transparent appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:h-4
                   [&::-webkit-slider-thumb]:w-4
                   [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-primary
                   [&::-webkit-slider-thumb]:border-2
                   [&::-webkit-slider-thumb]:border-surface-muted
                   [&::-webkit-slider-thumb]:shadow
                   [&::-webkit-slider-thumb]:transition-transform
                   [&::-webkit-slider-thumb]:group-hover:scale-110
                   focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background rounded-full
                   "
      />
    </div>
  );
};
