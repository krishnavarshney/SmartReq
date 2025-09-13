import React from 'react';
import { Tab } from '../../../types';
import { Plus, X } from '../../icons';
import { IconButton } from '../../ui/Button';
import { Tooltip } from '../../ui/Tooltip';

interface RequestTabsProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
}

export const RequestTabs: React.FC<RequestTabsProps> = ({ tabs, activeTabId, onSelectTab, onCloseTab, onNewTab }) => {
  return (
    <div className="flex items-end border-b border-border flex-shrink-0 h-10">
      <div className="flex items-end overflow-x-auto h-full">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex items-center gap-2 pl-3 pr-2 h-full border-r border-border cursor-pointer transition-colors relative group ${
              activeTabId === tab.id
                ? 'bg-card'
                : 'bg-muted hover:bg-card/80'
            }`}
          >
            <span className={`text-sm whitespace-nowrap transition-colors ${activeTabId === tab.id ? 'text-foreground' : 'text-muted-foreground'}`}>{tab.name}</span>
            {tab.isDirty && !tab.name.endsWith('*') && (
              <span className="text-primary">*</span>
            )}
            <IconButton
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="h-6 w-6 text-muted-foreground hover:bg-border hover:text-foreground opacity-50 group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        ))}
      </div>
       <Tooltip content="New Request">
        <IconButton onClick={onNewTab} variant="ghost" className="h-10 w-10 border-l border-border">
          <Plus className="h-4 w-4" />
        </IconButton>
      </Tooltip>
    </div>
  );
};
