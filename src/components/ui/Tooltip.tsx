import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  if (!content) {
    return <>{children}</>;
  }

  useLayoutEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const portal = tooltipRef.current;

      let top = triggerRect.top - tooltipRect.height - 8;
      let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);

      if (top < 8) {
        top = triggerRect.bottom + 8;
      }
      if (left < 8) {
        left = 8;
      }
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }

      portal.style.top = `${top}px`;
      portal.style.left = `${left}px`;
    }
  }, [isVisible]);
  
  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-describedby="tooltip"
        className="inline-flex"
      >
        {children}
      </span>
      {isVisible && createPortal(
        <div 
            ref={tooltipRef}
            role="tooltip"
            id="tooltip"
            className="fixed px-2 py-1 glass-surface-lite elev-2 text-popover-foreground text-xs rounded-md shadow-popover z-[9999] animate-slide-up-and-fade"
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};