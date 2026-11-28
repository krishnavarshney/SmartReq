import React, { createContext, useContext, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DropdownMenuContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | undefined>(undefined);

export const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      {children}
    </DropdownMenuContext.Provider>
  );
};

const useDropdownMenu = () => {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error('useDropdownMenu must be used within a DropdownMenu provider');
  return context;
};

export const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
  ({ children, asChild = false, ...props }, ref) => {
    const { isOpen, setIsOpen, triggerRef } = useDropdownMenu();
    
    const handleRef = (node: HTMLButtonElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref: handleRef,
        'aria-expanded': isOpen,
        'aria-haspopup': 'menu',
        onClick: (e: React.MouseEvent) => {
            setIsOpen(!isOpen);
            const childProps = children.props as any;
            if (childProps && typeof childProps.onClick === 'function') {
              childProps.onClick(e);
            }
        },
        ...props,
      });
    }

    return (
      <button
        ref={handleRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen(!isOpen)}
        {...props}
      >
        {children}
      </button>
    );
  }
);


export const DropdownMenuContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => {
    const { isOpen, setIsOpen, triggerRef } = useDropdownMenu();
    const contentRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0, minWidth: 0 });

    useLayoutEffect(() => {
      if (isOpen && triggerRef.current && contentRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        let top = triggerRect.bottom + 4;
        let left = triggerRect.right - contentRef.current.offsetWidth;
        
        if (top + contentRef.current.offsetHeight > window.innerHeight) {
            top = triggerRect.top - contentRef.current.offsetHeight - 4;
        }

        if (left < 8) {
            left = 8;
        }

        setPosition({ top, left, minWidth: triggerRect.width });
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

    useEffect(() => {
      if (!isOpen) return;
      const raf = requestAnimationFrame(() => contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus());
      return () => cancelAnimationFrame(raf);
    }, [isOpen]);

    if (!isOpen) return null;

    const onKeyDown = (e: React.KeyboardEvent) => {
      const items = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
      const idx = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setIsOpen(false); triggerRef.current?.focus(); }
      else if (e.key === 'Tab') { setIsOpen(false); }
    };

    return createPortal(
      <div
        ref={contentRef}
        role="menu"
        onKeyDown={onKeyDown}
        style={{ top: `${position.top}px`, left: `${position.left}px`, minWidth: `${Math.max(position.minWidth, 160)}px` }}
        className={`fixed bg-popover text-popover-foreground border border-border rounded-lg shadow-popover z-[60] p-1 animate-scale-in ${className}`}
        {...props}
      >
        {children}
      </div>,
      document.body
    );
  }
);

export const DropdownMenuItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { destructive?: boolean }>(
  ({ children, className = '', onClick, destructive, ...props }, ref) => {
    const { setIsOpen, triggerRef } = useDropdownMenu();

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        {...props}
        onClick={(e) => {
          onClick?.(e);
          setIsOpen(false);
          triggerRef.current?.focus();
        }}
        className={`w-full text-left flex items-center gap-2 rounded-md px-2 h-8 text-[13px] outline-none cursor-pointer hover:bg-accent focus-visible:bg-accent disabled:opacity-40 disabled:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-muted-foreground ${destructive ? 'text-destructive-text hover:bg-destructive-bg [&_svg]:!text-destructive-text' : ''} ${className}`}
      >
        {children}
      </button>
    );
  }
);

export const DropdownMenuSeparator: React.FC = () => <div role="separator" className="-mx-1 my-1 h-px bg-border" />;

export const DropdownMenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</div>
);
