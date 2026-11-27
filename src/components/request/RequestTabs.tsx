import React from 'react';
import { Plus, X } from '../icons';
import { IconButton } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { motion } from 'framer-motion';
import { useTabs } from '../../context/TabsContext';
import { TypingAnimator } from '../ui/TypingAnimator';

interface RequestTabsProps {
  onNewTab: () => void;
}

export const RequestTabs: React.FC<RequestTabsProps> = ({ onNewTab }) => {
  const { tabs, activeTabId, setActiveTabId, closeTab, updateTab } = useTabs();
  const showCreateHint = tabs.length === 0;

  const handleAnimationComplete = (tabId: string) => {
    updateTab(tabId, { isRenaming: false });
  };

  return (
    <div className="flex items-center border-b border-border flex-shrink-0 h-10">
      <div className="flex items-center overflow-x-auto h-full flex-grow no-scrollbar">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`relative flex items-center gap-2 pl-3 pr-2 h-full border-r border-border cursor-pointer group whitespace-nowrap`}
          >
            <span className={`relative z-10 text-sm transition-colors ${activeTabId === tab.id ? 'text-primary' : 'text-muted-foreground'}`}>
              {tab.isRenaming ? (
                <TypingAnimator text={tab.name} onComplete={() => handleAnimationComplete(tab.id)} />
              ) : (
                tab.name
              )}
            </span>
            {tab.isDirty && (
              <div className="relative z-10 w-2 h-2 rounded-full bg-primary" />
            )}
            <IconButton
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="relative z-10 h-6 w-6 text-muted-foreground hover:bg-border hover:text-foreground opacity-50 group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
            {activeTabId === tab.id && (
                <motion.div
                    layoutId="active-request-tab-background"
                    className="absolute inset-0 bg-card border-b-2 border-primary"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
            )}
          </div>
        ))}
      </div>
       <Tooltip content={showCreateHint ? "Click here to start a new request" : "New Request"}>
        <IconButton 
          onClick={onNewTab} 
          variant="ghost" 
          className={`h-10 w-10 border-l border-border ${showCreateHint ? 'animate-button-glow rounded-md' : ''}`}
        >
          <Plus className="h-4 w-4" />
        </IconButton>
      </Tooltip>
    </div>
  );
};