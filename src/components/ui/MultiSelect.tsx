import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, XCircle } from '../icons';
import { Checkbox } from './Checkbox';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onSelectionChange, placeholder = "Select keys..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onSelectionChange(selected.filter(s => s !== option));
    } else {
      onSelectionChange([...selected, option]);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-wrap items-center gap-2 p-1 border border-border rounded-md cursor-pointer themed-input min-h-[36px]"
      >
        <div className="flex-grow flex flex-wrap gap-2 items-center">
            {selected.length > 0 ? (
              selected.map(sel => (
                <div key={sel} className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded text-sm">
                  <span>{sel}</span>
                  <button onClick={(e) => { e.stopPropagation(); toggleOption(sel); }} className="text-muted-foreground hover:text-foreground">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ))
            ) : (
              <span className="text-muted-foreground px-2">{placeholder}</span>
            )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-popover border border-border rounded-md shadow-lg z-10 p-2 max-h-60 overflow-y-auto animate-scale-in">
          {options.length > 0 ? options.map(option => (
            <div key={option} onClick={() => toggleOption(option)} className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-accent">
              <Checkbox checked={selected.includes(option)} onCheckedChange={() => {}} />
              <span className="text-sm">{option}</span>
            </div>
          )) : (
            <div className="text-sm text-muted-foreground text-center p-2">No options available.</div>
          )}
        </div>
      )}
    </div>
  );
};