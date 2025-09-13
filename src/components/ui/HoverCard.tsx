import React, { useState, useRef, useLayoutEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

interface HoverCardContextType {
  isOpen: boolean;
  triggerRef: React.RefObject<HTMLSpanElement> | null;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
}

const HoverCardContext = createContext<HoverCardContextType | undefined>(undefined);

export const HoverCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timeoutId = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleMouseEnter = () => {
    if (timeoutId.current) {
        clearTimeout(timeoutId.current);
    }
    setIsOpen(true);
  };
  
  const handleMouseLeave = () => {
    timeoutId.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  };
  
  return (
    <HoverCardContext.Provider value={{ isOpen, triggerRef, handleMouseEnter, handleMouseLeave }}>
      {children}
    </HoverCardContext.Provider>
  );
};

export const HoverCardTrigger: React.FC<{ children: React.ReactNode, asChild?: boolean }> = ({ children, asChild }) => {
  const context = useContext(HoverCardContext);
  if (!context) throw new Error("HoverCardTrigger must be used within HoverCard");

  return (
      <span
        ref={context.triggerRef}
        onMouseEnter={context.handleMouseEnter}
        onMouseLeave={context.handleMouseLeave}
        className="inline-flex"
      >
        {children}
      </span>
  );
};

export const HoverCardContent: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => {
  const context = useContext(HoverCardContext);
  if (!context) throw new Error("HoverCardContent must be used within HoverCard");

  const { isOpen, triggerRef } = context;
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (isOpen && triggerRef?.current && contentRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const contentRect = contentRef.current.getBoundingClientRect();
        
        let top = triggerRect.top - contentRect.height - 8;
        let left = triggerRect.left + (triggerRect.width / 2) - (contentRect.width / 2);

        if (top < 8) top = triggerRect.bottom + 8;
        if (left < 8) left = 8;
        if (left + contentRect.width > window.innerWidth) left = window.innerWidth - contentRect.width - 8;

        setPosition({ top, left });
    }
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={contentRef}
      onMouseEnter={context.handleMouseEnter}
      onMouseLeave={context.handleMouseLeave}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      className={`
        fixed w-max min-w-[250px]
        bg-popover border border-border text-popover-foreground text-xs rounded-md 
        shadow-popover z-50
        ${isOpen ? 'animate-slide-up-and-fade' : 'opacity-0 pointer-events-none'}
        ${className}
      `}
    >
      {children}
    </div>,
    document.body
  );
};
