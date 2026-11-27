import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from '../icons';

interface SelectContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedValue: string;
  select: (value: string) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  selectedNode: React.ReactNode;
  listId: string;
}

const SelectContext = createContext<SelectContextType | undefined>(undefined);

interface SelectProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

/** Depth-first search of the element tree for the SelectItem matching `value`. */
const findItemChildren = (node: React.ReactNode, value: string): React.ReactNode | undefined => {
  let found: React.ReactNode | undefined;
  React.Children.forEach(node, (child) => {
    if (found !== undefined || !React.isValidElement(child)) return;
    const props = child.props as { value?: string; children?: React.ReactNode };
    if (child.type === SelectItem && props.value === value) {
      found = props.children;
      return;
    }
    if (props.children) found = findItemChildren(props.children, value);
  });
  return found;
};

export const Select: React.FC<SelectProps> = ({ children, value, defaultValue, onValueChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue || '');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selectedValue = value !== undefined ? value : internal;
  const selectedNode = selectedValue ? (findItemChildren(children, selectedValue) ?? selectedValue) : null;

  const select = (v: string) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <SelectContext.Provider value={{ isOpen, setIsOpen, selectedValue, select, triggerRef, selectedNode, listId }}>
      {children}
    </SelectContext.Provider>
  );
};

const useSelect = () => {
  const context = useContext(SelectContext);
  if (!context) throw new Error('useSelect must be used within a Select provider');
  return context;
};

export const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, className = '', onKeyDown, ...props }, ref) => {
    const { isOpen, setIsOpen, triggerRef, listId } = useSelect();

    const handleRef = (node: HTMLButtonElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    return (
      <button
        ref={handleRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={`flex h-8 min-w-0 items-center justify-between gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm text-foreground transition-colors hover:bg-accent/50 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50 ${className}`}
        {...props}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">{children}</span>
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

export const SelectValue: React.FC<{ placeholder?: string; className?: string }> = ({ placeholder, className = '' }) => {
  const { selectedNode } = useSelect();
  return (
    <span className={`truncate ${selectedNode ? '' : 'text-muted-foreground'} ${className}`}>
      {selectedNode ?? placeholder}
    </span>
  );
};

export const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, _ref) => {
    const { isOpen, setIsOpen, triggerRef, listId, selectedValue } = useSelect();
    const contentRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const [active, setActive] = useState(-1);

    const options = () => Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? []);

    useLayoutEffect(() => {
      if (!isOpen) {
        setPosition(null);
        return;
      }
      if (!triggerRef.current || !contentRef.current) return;
      const t = triggerRef.current.getBoundingClientRect();
      const c = contentRef.current.getBoundingClientRect();
      const width = Math.max(t.width, c.width, 140);
      let top = t.bottom + 4;
      if (top + c.height > window.innerHeight - 8 && t.top > c.height + 8) top = t.top - c.height - 4;
      const left = Math.max(8, Math.min(t.left, window.innerWidth - width - 8));
      setPosition({ top, left, width });
      const opts = options();
      const idx = opts.findIndex((o) => o.dataset.value === selectedValue);
      setActive(idx >= 0 ? idx : 0);
      contentRef.current.focus({ preventScroll: true });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
      options()[active]?.scrollIntoView({ block: 'nearest' });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    useEffect(() => {
      if (!isOpen) return;
      const onDown = (event: MouseEvent) => {
        const target = event.target as Node;
        if (!triggerRef.current?.contains(target) && !contentRef.current?.contains(target)) setIsOpen(false);
      };
      const onScroll = (e: Event) => {
        if (!contentRef.current?.contains(e.target as Node)) setIsOpen(false);
      };
      document.addEventListener('mousedown', onDown);
      window.addEventListener('resize', onScroll);
      window.addEventListener('scroll', onScroll, true);
      return () => {
        document.removeEventListener('mousedown', onDown);
        window.removeEventListener('resize', onScroll);
        window.removeEventListener('scroll', onScroll, true);
      };
    }, [isOpen, setIsOpen, triggerRef]);

    if (!isOpen) return null;

    const handleKeyDown = (e: React.KeyboardEvent) => {
      const opts = options();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(opts.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActive(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActive(opts.length - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        opts[active]?.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'Tab') {
        setIsOpen(false);
      }
    };

    return createPortal(
      <div
        ref={contentRef}
        id={listId}
        role="listbox"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseMove={(e) => {
          const el = (e.target as HTMLElement).closest('[role="option"]');
          if (el) setActive(options().indexOf(el as HTMLElement));
        }}
        style={position ? { top: position.top, left: position.left, minWidth: position.width } : { top: -9999, left: -9999, visibility: 'hidden' }}
        className={`fixed z-[60] max-h-72 overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-popover outline-none animate-scale-in ${className}`}
        {...props}
      >
        <ActiveIndexContext.Provider value={active}>{children}</ActiveIndexContext.Provider>
      </div>,
      document.body
    );
  }
);
SelectContent.displayName = 'SelectContent';

const ActiveIndexContext = createContext(-1);

export const SelectItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string; disabled?: boolean }>(
  ({ children, className = '', value, disabled, ...props }, ref) => {
    const { selectedValue, select } = useSelect();
    const innerRef = useRef<HTMLDivElement | null>(null);
    const activeIndex = useContext(ActiveIndexContext);
    const [isActive, setIsActive] = useState(false);
    const isSelected = selectedValue === value;

    useLayoutEffect(() => {
      const el = innerRef.current;
      const list = el?.closest('[role="listbox"]');
      if (!el || !list) return;
      const opts = Array.from(list.querySelectorAll('[role="option"]:not([aria-disabled="true"])'));
      setIsActive(opts.indexOf(el) === activeIndex);
    }, [activeIndex]);

    return (
      <div
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        role="option"
        aria-selected={isSelected}
        aria-disabled={disabled || undefined}
        data-value={value}
        data-state={isSelected ? 'checked' : 'unchecked'}
        onClick={() => !disabled && select(value)}
        className={`relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-sm outline-none ${
          isActive ? 'bg-accent text-accent-foreground' : ''
        } ${disabled ? 'pointer-events-none opacity-40' : ''} ${className}`}
        {...props}
      >
        {isSelected && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <Check className="h-3.5 w-3.5 text-primary" />
          </span>
        )}
        {children}
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';
