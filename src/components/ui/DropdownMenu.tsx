import React, { createContext, useContext, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DropdownMenuContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
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

    if (!isOpen) return null;

    return createPortal(
      <div
        ref={contentRef}
        style={{ top: `${position.top}px`, left: `${position.left}px`, minWidth: `${position.minWidth}px` }}
        className={`fixed bg-popover text-popover-foreground border border-border rounded-md shadow-popover z-50 p-1 animate-scale-in ${className}`}
        {...props}
      >
        {children}
      </div>,
      document.body
    );
  }
);

export const DropdownMenuItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, className = '', ...props }, ref) => {
    const { setIsOpen } = useDropdownMenu();
    
    return (
      <button
        ref={ref}
        role="menuitem"
        onClick={(e) => {
          props.onClick?.(e);
          setIsOpen(false);
        }}
        className={`w-full text-left flex items-center rounded-sm px-2 py-1.5 text-sm outline-none cursor-pointer hover:bg-accent ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
