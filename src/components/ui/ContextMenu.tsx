import React, { createContext, useContext, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  position: { top: number; left: number };
  setPosition: (position: { top: number; left: number }) => void;
  returnFocusRef: React.MutableRefObject<HTMLElement | null>;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export const ContextMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <ContextMenuContext.Provider value={{ isOpen, setIsOpen, position, setPosition, returnFocusRef }}>{children}</ContextMenuContext.Provider>
  );
};

const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  if (!context) throw new Error('useContextMenu must be used within a ContextMenu provider');
  return context;
};

/** Wraps a single element and opens the menu on right click (or the keyboard context-menu key / Shift+F10). */
export const ContextMenuTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setIsOpen, setPosition, returnFocusRef } = useContextMenu();

  if (!React.isValidElement(children)) return null;
  const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;

  const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
    child.props.onContextMenu?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    let { clientX: left, clientY: top } = e;
    // Keyboard-invoked context menus report (0, 0): anchor to the element instead.
    if (left === 0 && top === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      left = rect.left + 24;
      top = rect.bottom;
    }
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setPosition({ top, left });
    setIsOpen(true);
  };

  return React.cloneElement(child, { onContextMenu: handleContextMenu });
};

export const ContextMenuContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, _ref) => {
    const { isOpen, setIsOpen, position, returnFocusRef } = useContextMenu();
    const contentRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });

    useLayoutEffect(() => {
      if (!isOpen || !contentRef.current) return;
      const menu = contentRef.current;
      const { innerWidth, innerHeight } = window;
      const left = Math.max(8, Math.min(position.left, innerWidth - menu.offsetWidth - 8));
      const top = Math.max(8, Math.min(position.top, innerHeight - menu.offsetHeight - 8));
      setStyle({ top: `${top}px`, left: `${left}px` });
    }, [isOpen, position]);

    useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (event: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(event.target as Node)) setIsOpen(false);
      };
      const close = () => setIsOpen(false);
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
      window.addEventListener('blur', close);
      const raf = requestAnimationFrame(() => contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus());
      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', close, true);
        window.removeEventListener('resize', close);
        window.removeEventListener('blur', close);
      };
    }, [isOpen, setIsOpen]);

    if (!isOpen) return null;

    const onKeyDown = (e: React.KeyboardEvent) => {
      const items = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
      const idx = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        returnFocusRef.current?.focus?.();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setIsOpen(false);
        returnFocusRef.current?.focus?.();
      }
    };

    return createPortal(
      <div
        ref={contentRef}
        style={style}
        role="menu"
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        className={`fixed z-[60] min-w-[180px] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-popover animate-scale-in ${className}`}
        {...props}
      >
        {children}
      </div>,
      document.body
    );
  }
);
ContextMenuContent.displayName = 'ContextMenuContent';

export const ContextMenuItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { destructive?: boolean; shortcut?: string }>(
  ({ children, className = '', onClick, destructive, shortcut, ...props }, ref) => {
    const { setIsOpen, returnFocusRef } = useContextMenu();
    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        {...props}
        onClick={(e) => {
          setIsOpen(false);
          returnFocusRef.current?.focus?.({ preventScroll: true });
          onClick?.(e);
        }}
        className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:flex-shrink-0 ${
          destructive ? 'text-destructive-text hover:bg-destructive-bg focus-visible:bg-destructive-bg' : '[&_svg]:text-muted-foreground'
        } ${className}`}
      >
        {children}
        {shortcut && <span className="ml-auto pl-4 text-[11px] text-muted-foreground">{shortcut}</span>}
      </button>
    );
  }
);
ContextMenuItem.displayName = 'ContextMenuItem';

export const ContextMenuSeparator: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div role="separator" className={`-mx-1 my-1 h-px bg-border ${className}`} />
);
