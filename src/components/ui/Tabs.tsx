import React, { createContext, useContext, useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
  layoutId: string;
}

const TabsContext = createContext<TabsContextType | null>(null);

interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const Tabs: React.FC<TabsProps> = ({ children, defaultValue, value, onValueChange, className, orientation = 'horizontal' }) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const id = useId();
  const layoutId = `active-tab-${id}`;

  const controlledValue = value !== undefined ? value : internalValue;
  const handleValueChange = (newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue);
    }
    if (value === undefined) {
      setInternalValue(newValue);
    }
  };

  useEffect(() => {
    if (defaultValue && !value) {
        setInternalValue(defaultValue);
    }
  }, [defaultValue, value]);

  return (
    <TabsContext.Provider value={{ value: controlledValue, onValueChange: handleValueChange, orientation, layoutId }}>
      <div className={`${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => {
        const context = useContext(TabsContext);
        if (!context) return null;
        const orientationClass = context.orientation === 'horizontal' ? 'border-b border-border' : '';
        return (
            <div 
                ref={ref} 
                className={`relative flex items-center ${orientationClass} ${className} p-1 bg-background/60 rounded-lg backdrop-blur-sm`} 
                role="tablist" 
                {...props}
            >
                {children}
                {/* Animated underline for horizontal tabs */}
                {context.orientation === 'horizontal' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border" />
                )}
            </div>
        )
    }
);

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  badge?: number | string | React.ReactNode;
  disabled?: boolean;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, children, badge, disabled }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within a Tabs component');
  
  const { value: activeValue, onValueChange, orientation, layoutId } = context;
  const isActive = activeValue === value;
  
  const isReactNodeBadge = React.isValidElement(badge);
  const showBadge = (badge !== undefined && badge !== 0 && badge !== 'none' && String(badge).toLowerCase() !== "0") || isReactNodeBadge;

  const orientationClasses = orientation === 'vertical'
    ? 'justify-start w-full px-3 py-2'
    : 'px-4 py-2';

  return (
    <button
      onClick={() => onValueChange(value)}
      disabled={disabled}
      data-state={isActive ? 'active' : 'inactive'}
      className={`
        group relative text-sm font-medium transition-colors duration-200
        flex items-center whitespace-nowrap
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        disabled:opacity-50 disabled:pointer-events-none rounded-md
        ${isActive 
            ? 'text-primary' 
            : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'}
        ${orientationClasses}
      `}
      role="tab"
      aria-selected={isActive}
    >
      <span className={`relative z-10 flex-grow ${orientation === 'vertical' ? 'text-left' : 'text-center'}`}>{children}</span>
      {isActive && <motion.div layout layoutId={layoutId} className="absolute inset-0 bg-primary/10 rounded-md" style={{ zIndex: 10 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} />}

      {showBadge && (
        isReactNodeBadge ? (
           <span className="relative z-10 ml-2 text-xs font-semibold">{badge}</span>
        ) : (
            <span className={`relative z-10 ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full transition-colors truncate max-w-[80px] ${
                isActive 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-muted text-muted-foreground group-hover:bg-border'
            }`}>
                {badge}
            </span>
        )
      )}
    </button>
  );
};

interface TabContentProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

export const TabsContent: React.FC<TabContentProps> = ({ value, children, className }) => {
    const context = useContext(TabsContext);
    if (!context) {
        // Gracefully no-op if rendered before Tabs mounts (e.g., conditional trees / portals)
        return null;
    }
    
    // Remove animation for vertical tabs to avoid perceived lag
    if (context.orientation === 'vertical') {
        return context.value === value ? (
            <div role="tabpanel" className={`${className || 'h-full'}`}>
                {children}
            </div>
        ) : null;
    }

    return (
        <AnimatePresence mode="wait">
            {context.value === value && (
                <motion.div
                    key={value}
                    role="tabpanel"
                    className={`${className || 'h-full'}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
};