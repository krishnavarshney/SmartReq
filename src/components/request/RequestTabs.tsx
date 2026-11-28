import React, { useEffect, useRef, useState } from 'react';
import { Plus, X, Copy } from '../icons';
import { IconButton } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmDialog } from '../ui/Modal';
import { useTabs } from '../../context/TabsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { TypingAnimator } from '../ui/TypingAnimator';
import { getMethodClass, getMethodShort } from '../../utils/http-ui';
import { Tab } from '../../types';

interface RequestTabsProps {
  onNewTab: () => void;
}

export const RequestTabs: React.FC<RequestTabsProps> = ({ onNewTab }) => {
  const { tabs, activeTabId, setActiveTabId, closeTab, updateTab, duplicateTab } = useTabs();
  const { findNode, updateNode } = useWorkspace();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingClose, setPendingClose] = useState<Tab | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the active tab in view.
  useEffect(() => {
    if (!activeTabId) return;
    scrollerRef.current?.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId, tabs.length]);

  const requestClose = (tab: Tab) => {
    if (tab.isDirty) setPendingClose(tab);
    else closeTab(tab.id);
  };

  const startRename = (tab: Tab) => {
    setDraftName(tab.name);
    setRenamingId(tab.id);
  };

  const commitRename = () => {
    const tab = tabs.find((t) => t.id === renamingId);
    const name = draftName.trim();
    if (tab && name && name !== tab.name) {
      updateTab(tab.id, { name, isRenaming: false });
      // Keep the saved request's name in step with its tab.
      if (tab.originalRequestId && findNode(tab.originalRequestId)) {
        updateNode(tab.originalRequestId, (node) => {
          if (node.type === 'request') node.name = name;
          return node;
        });
      }
    }
    setRenamingId(null);
  };

  const onTabKeyDown = (e: React.KeyboardEvent, tab: Tab, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      setActiveTabId(next.id);
      requestAnimationFrame(() => scrollerRef.current?.querySelector<HTMLElement>(`[data-tab-id="${next.id}"]`)?.focus());
    } else if (e.key === 'F2') {
      e.preventDefault();
      startRename(tab);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      requestClose(tab);
    }
  };

  return (
    <div className="flex h-9 flex-shrink-0 items-stretch border-b border-border bg-background">
      <div
        ref={scrollerRef}
        role="tablist"
        aria-label="Open requests"
        className="no-scrollbar flex min-w-0 items-stretch overflow-x-auto"
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
        }}
      >
        {tabs.map((tab, index) => {
          const active = tab.id === activeTabId;
          const renaming = renamingId === tab.id;
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              title={`${tab.request.method} ${tab.request.url || tab.name}\nDouble-click to rename`}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => startRename(tab)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  requestClose(tab);
                }
              }}
              onMouseDown={(e) => e.button === 1 && e.preventDefault()}
              onKeyDown={(e) => !renaming && onTabKeyDown(e, tab, index)}
              className={`group relative flex min-w-[120px] max-w-[220px] flex-shrink-0 cursor-pointer select-none items-center gap-2 border-r border-border pl-3 pr-1.5 text-[13px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                active ? 'bg-card text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              {active && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
              <span className={`flex-shrink-0 font-mono text-[10px] font-semibold ${getMethodClass(tab.request.method)}`}>{getMethodShort(tab.request.method)}</span>
              {renaming ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  aria-label="Tab name"
                  className="h-6 min-w-0 flex-1 rounded border border-ring bg-background px-1 text-[13px] text-foreground outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">
                  {tab.isRenaming ? <TypingAnimator text={tab.name} onComplete={() => updateTab(tab.id, { isRenaming: false })} /> : tab.name}
                </span>
              )}
              <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {tab.isDirty && (
                  <span aria-label="Unsaved changes" role="img" className="h-1.5 w-1.5 rounded-full bg-primary group-hover:hidden group-focus-within:hidden" />
                )}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    requestClose(tab);
                  }}
                  aria-label={`Close ${tab.name}`}
                  className={`absolute inset-0 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground ${
                    tab.isDirty ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' : active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5 px-1">
        <Tooltip content="New request" side="bottom">
          <IconButton size="sm" onClick={onNewTab} aria-label="New request">
            <Plus className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        {activeTabId && (
          <Tooltip content="Duplicate tab" side="bottom">
            <IconButton size="sm" onClick={() => duplicateTab(activeTabId)} aria-label="Duplicate tab" className="hidden sm:inline-flex">
              <Copy className="h-3.5 w-3.5" />
            </IconButton>
          </Tooltip>
        )}
      </div>
      <ConfirmDialog
        show={!!pendingClose}
        title="Close without saving?"
        description={pendingClose ? `"${pendingClose.name}" has unsaved changes. They will be lost.` : undefined}
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => {
          if (pendingClose) closeTab(pendingClose.id);
          setPendingClose(null);
        }}
        onCancel={() => setPendingClose(null)}
      />
    </div>
  );
};
