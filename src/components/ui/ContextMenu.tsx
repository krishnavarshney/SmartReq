import React, { createContext, useContext, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  position: { top: number; left: number };
  setPosition: (position: { top: number; left: number }) => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export const ContextMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  return (
    <ContextMenuContext.Provider value={{ isOpen, setIsOpen, position, setPosition }}>
      {children}
    </ContextMenuContext.Provider>
  );
};

const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  if (!context) throw new Error('useContextMenu must be used within a ContextMenu provider');
  return context;
};

export const ContextMenuTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { setIsOpen, setPosition } = useContextMenu();

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setPosition({ top: e.clientY, left: e.clientX });
        setIsOpen(true);
    };
    
    if (React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, { onContextMenu: handleContextMenu });
    }

    return null;
};


export const ContextMenuContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => {
    const { isOpen, setIsOpen, position } = useContextMenu();
    const contentRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0, pointerEvents: 'none' });


    useLayoutEffect(() => {
        if (isOpen && contentRef.current) {
            const menu = contentRef.current;
            const { innerWidth, innerHeight } = window;
            const menuWidth = menu.offsetWidth;
            const menuHeight = menu.offsetHeight;
            
            let top = position.top;
            let left = position.left;

            if (left + menuWidth > innerWidth) {
                left = innerWidth - menuWidth - 8;
            }
            if (top + menuHeight > innerHeight) {
                top = innerHeight - menuHeight - 8;
            }

            setStyle({ top: `${top}px`, left: `${left}px` });
        }
    }, [isOpen, position]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      const handleScroll = () => setIsOpen(false);
      
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }, [isOpen, setIsOpen]);

    if (!isOpen) return null;

    return createPortal(
      <div
        ref={contentRef}
        style={style}
        role="menu"
        className={`fixed bg-popover text-popover-foreground border border-border rounded-md shadow-popover z-50 p-1 w-48 animate-scale-in ${className}`}
        {...props}
      >
        {children}
      </div>,
      document.body
    );
  }
);

export const ContextMenuItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, className = '', ...props }, ref) => {
    const { setIsOpen } = useContextMenu();
    
    return (
      <button
        ref={ref}
        role="menuitem"
        onClick={(e) => {
          props.onClick?.(e);
          setIsOpen(false);
        }}
        className={`w-full text-left flex items-center rounded-sm px-2 py-1.5 text-sm outline-none cursor-pointer hover:bg-accent data-[disabled]:opacity-50 data-[disabled]:pointer-events-none ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

export const ContextMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = '', ...props }, ref) => {
        return <div ref={ref} className={`h-px my-1 -mx-1 bg-border ${className}`} {...props} />;
    }
);
