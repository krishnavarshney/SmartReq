import React from 'react';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onCheckedChange, id, disabled, size = 'md', ...aria }) => {
  const track = size === 'sm' ? 'h-4 w-7' : 'h-5 w-9';
  const thumb = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const shift = size === 'sm' ? 'translate-x-3' : 'translate-x-4';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex ${track} flex-shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-150 focus-ring disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-input'
      }`}
      {...aria}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block ${thumb} rounded-full bg-white shadow-sm transition-transform duration-150 ${checked ? shift : 'translate-x-0'}`}
      />
    </button>
  );
};
