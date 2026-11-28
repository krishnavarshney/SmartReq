import React, { createContext, useContext, useId, useState } from 'react';
import { motion } from 'framer-motion';

type TabsVariant = 'underline' | 'pills';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
  variant: TabsVariant;
  layoutId: string;
  baseId: string;
}

const TabsContext = createContext<TabsContextType | null>(null);

interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  /** underline: classic tab strip. pills: compact segmented look. */
  variant?: TabsVariant;
}

const slug = (v: string) => v.replace(/[^a-zA-Z0-9_-]/g, '_');

export const Tabs: React.FC<TabsProps> = ({
  children,
  defaultValue,
  value,
  onValueChange,
  className = '',
  orientation = 'horizontal',
  variant = 'underline',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const id = useId();
  const controlledValue = value !== undefined ? value : internalValue;
  const handleValueChange = (newValue: string) => {
    onValueChange?.(newValue);
    if (value === undefined) setInternalValue(newValue);
  };

  return (
    <TabsContext.Provider
      value={{ value: controlledValue, onValueChange: handleValueChange, orientation, variant, layoutId: `tab-ind-${id}`, baseId: id }}
    >
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, onKeyDown, ...props }, ref) => {
    const context = useContext(TabsContext);
    if (!context) return null;
    const vertical = context.orientation === 'vertical';

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      const keys = vertical ? ['ArrowUp', 'ArrowDown', 'Home', 'End'] : ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(e.key)) return;
      const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
      const idx = tabs.findIndex((t) => t === document.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      let next = idx;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
      else next = (idx - 1 + tabs.length) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    };

    const variantClass = vertical
      ? 'flex-col items-stretch gap-0.5'
      : context.variant === 'pills'
        ? 'items-center gap-0.5 rounded-lg bg-muted p-0.5'
        : 'items-stretch gap-1 border-b border-border';

    return (
      <div
        ref={ref}
        role="tablist"
        aria-orientation={context.orientation}
        onKeyDown={handleKeyDown}
        className={`relative flex ${variantClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = 'TabsList';

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  badge?: number | string | React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  title?: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, children, badge, disabled, icon, className = '', title }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within a Tabs component');

  const { value: activeValue, onValueChange, orientation, variant, layoutId, baseId } = context;
  const isActive = activeValue === value;
  const vertical = orientation === 'vertical';

  const isNodeBadge = React.isValidElement(badge);
  const showBadge = isNodeBadge || (badge !== undefined && badge !== null && badge !== 0 && badge !== '' && String(badge).toLowerCase() !== 'none' && String(badge) !== '0');

  let shape: string;
  if (vertical) {
    shape = `h-8 w-full justify-start rounded-md px-2.5 ${isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}`;
  } else if (variant === 'pills') {
    shape = `h-7 rounded-md px-2.5 ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`;
  } else {
    shape = `h-9 px-2.5 -mb-px ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`;
  }

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${slug(value)}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${slug(value)}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      title={title}
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => onValueChange(value)}
      className={`group relative flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40 ${shape} ${className}`}
    >
      {!vertical && variant === 'pills' && isActive && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-md bg-card shadow-[0_1px_2px_rgb(0_0_0/0.15)] ring-1 ring-border"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      {!vertical && variant === 'underline' && isActive && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      {icon && <span className="relative z-10 flex [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
      <span className={`relative z-10 ${vertical ? 'flex-1 truncate text-left' : ''}`}>{children}</span>
      {showBadge &&
        (isNodeBadge ? (
          <span className="relative z-10 text-[11px] font-medium">{badge}</span>
        ) : (
          <span
            className={`relative z-10 min-w-[18px] max-w-[80px] truncate rounded px-1 py-px text-center text-[10px] font-semibold tabular-nums ${
              isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            {badge}
          </span>
        ))}
    </button>
  );
};

interface TabContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  /** Keep the panel mounted (hidden) when inactive, preserving internal state. */
  forceMount?: boolean;
}

export const TabsContent: React.FC<TabContentProps> = ({ value, children, className, forceMount }) => {
  const context = useContext(TabsContext);
  if (!context) return null;
  const isActive = context.value === value;
  if (!isActive && !forceMount) return null;
  return (
    <div
      role="tabpanel"
      id={`${context.baseId}-panel-${slug(value)}`}
      aria-labelledby={`${context.baseId}-tab-${slug(value)}`}
      hidden={!isActive}
      className={`${className ?? 'h-full'} ${isActive ? 'animate-fade-in' : ''}`}
    >
      {children}
    </div>
  );
};
