import React, { createContext, useContext, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from '../icons';

interface SelectContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  selectedLabel: string;
  setSelectedLabel: (label: string) => void;
  onValueChange?: (value: string) => void;
}

const SelectContext = createContext<SelectContextType | undefined>(undefined);

interface SelectProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export const Select: React.FC<SelectProps> = ({ children, value, defaultValue, onValueChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || defaultValue || '');
  const [selectedLabel, setSelectedLabel] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  useEffect(() => {
    const valueToFind = value !== undefined ? value : selectedValue;

    if (!valueToFind) {
      setSelectedLabel('');
      return;
    }

    let foundLabel: string | null = null;
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === SelectContent) {
        React.Children.forEach((child.props as any).children, (item) => {
          if (React.isValidElement(item) && item.type === SelectItem && (item.props as any).value === valueToFind) {
            const itemChildren = (item.props as any).children;
            if (typeof itemChildren === 'string') {
              foundLabel = itemChildren;
            } else if (React.isValidElement(itemChildren) && typeof (itemChildren.props as any).children === 'string') {
              foundLabel = (itemChildren.props as any).children;
            }
          }
        });
      }
    });

    setSelectedLabel(foundLabel ?? valueToFind);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selectedValue, children]);

  const contextValue = {
    isOpen, setIsOpen,
    selectedValue, setSelectedValue,
    triggerRef,
    selectedLabel, setSelectedLabel,
    onValueChange,
  };

  return <SelectContext.Provider value={contextValue}>{children}</SelectContext.Provider>;
};

const useSelect = () => {
  const context = useContext(SelectContext);
  if (!context) throw new Error('useSelect must be used within a Select provider');
  return context;
};

export const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, className = '', ...props }, ref) => {
    const { isOpen, setIsOpen, triggerRef } = useSelect();
    
    const handleRef = (node: HTMLButtonElement) => {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };
    
    return (
      <button
        ref={handleRef}
        type="button"
        role="combobox"
        aria-controls="select-content"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={`themed-input flex items-center justify-between h-9 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
        {...props}
      >
        {children}
        <ChevronDown className={`h-4 w-4 ml-2 transition-transform duration-200 text-muted-foreground ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    );
  }
);

export const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  const { selectedValue, selectedLabel } = useSelect();
  return <span className="truncate">{selectedLabel || selectedValue || placeholder}</span>;
};

export const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => {
    const { isOpen, setIsOpen, triggerRef } = useSelect();
    const contentRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

    useLayoutEffect(() => {
      if (isOpen && triggerRef.current && contentRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const contentRect = contentRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - triggerRect.bottom;

        let top = triggerRect.bottom + 4;
        if (spaceBelow < contentRect.height && triggerRect.top > contentRect.height) {
            top = triggerRect.top - contentRect.height - 4;
        }

        const left = triggerRect.left;
        const width = triggerRect.width;
        setPosition({ top, left, width });
      }
    }, [isOpen, triggerRef]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
          contentRef.current && !contentRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, setIsOpen, triggerRef]);

    if (!isOpen) return null;

    return createPortal(
      <div
        ref={contentRef}
        id="select-content"
        role="listbox"
        style={{ top: `${position.top}px`, left: `${position.left}px`, width: `${position.width}px` }}
        className={`fixed bg-popover text-popover-foreground border border-border rounded-md shadow-popover z-50 p-1 animate-scale-in ${className}`}
        {...props}
      >
        {children}
      </div>,
      document.body
    );
  }
);

export const SelectItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
  ({ children, className = '', value, ...props }, ref) => {
    const { selectedValue, setSelectedValue, setSelectedLabel, setIsOpen, onValueChange } = useSelect();
    const isSelected = selectedValue === value;

    const handleSelect = () => {
      setSelectedValue(value);
      let label = value;
      if (typeof children === 'string') {
        label = children;
      } else if (React.isValidElement(children) && typeof (children.props as any).children === 'string') {
        label = (children.props as any).children;
      }
      setSelectedLabel(label);
      if (onValueChange) onValueChange(value);
      setIsOpen(false);
    };

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        data-state={isSelected ? 'checked' : 'unchecked'}
        onClick={handleSelect}
        className={`relative flex items-center w-full rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none cursor-pointer hover:bg-accent ${className}`}
        {...props}
      >
        {isSelected && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <Check className="h-4 w-4 text-primary" />
          </span>
        )}
        {children}
      </div>
    );
  }
);