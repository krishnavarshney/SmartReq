import React from 'react';
import { Resizable } from 're-resizable';
import { LogEntry, RequestItem } from '../../types';
import { LogPanel } from './LogPanel';
import { CollectionsView } from './CollectionsView';
import { EnvironmentsPanel } from './EnvironmentsPanel';
import { Tooltip } from '../ui/Tooltip';
import { FolderKanban, Globe, History } from '../icons';
import { SidebarPanel, useApp } from '../../context/AppContext';
import { useWorkspace } from '../../context/WorkspaceContext';

interface SidebarProps {
  onLogClick: (log: LogEntry) => void;
  openRequestInTab: (requestItem: RequestItem, tabName: string) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

const RAIL_WIDTH = 48;

const NAV: { panel: SidebarPanel; label: string; icon: React.ElementType }[] = [
  { panel: 'collections', label: 'Collections', icon: FolderKanban },
  { panel: 'environment', label: 'Environments', icon: Globe },
  { panel: 'history', label: 'History', icon: History },
];

export const Sidebar: React.FC<SidebarProps> = ({ onLogClick, openRequestInTab, selectedNodeId, setSelectedNodeId }) => {
  const { isSidebarOpen, setIsSidebarOpen, sidebarWidth, setSidebarWidth, sidebarPanel, setSidebarPanel, isMobile } = useApp();
  const { workspace, setWorkspace } = useWorkspace();

  const handleNavClick = (panel: SidebarPanel) => {
    if (panel === sidebarPanel && isSidebarOpen && !isMobile) {
      setIsSidebarOpen(false);
      return;
    }
    setSidebarPanel(panel);
    setIsSidebarOpen(true);
  };

  const openRequest = (item: RequestItem, name: string) => {
    openRequestInTab(item, name);
    if (isMobile) setIsSidebarOpen(false);
  };

  const panelContent = (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {sidebarPanel === 'collections' && (
        <CollectionsView
          workspace={workspace}
          setWorkspace={setWorkspace}
          openRequestInTab={openRequest}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
        />
      )}
      {sidebarPanel === 'environment' && <EnvironmentsPanel />}
      {sidebarPanel === 'history' && <LogPanel onLogClick={onLogClick} />}
    </div>
  );

  const rail = (
    <nav aria-label="Sidebar" className="flex w-12 flex-shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-2">
      {NAV.map(({ panel, label, icon: Icon }) => {
        const active = isSidebarOpen && sidebarPanel === panel;
        return (
          <Tooltip key={panel} content={label} side="right">
            <button
              type="button"
              onClick={() => handleNavClick(panel)}
              // Don't take focus on mouse click, or the focus-triggered tooltip lingers over the panel.
              onMouseDown={(e) => e.preventDefault()}
              aria-label={label}
              aria-pressed={active}
              className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-ring ${
                active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              {active && <span className="absolute -left-[7px] top-2 bottom-2 w-0.5 rounded-full bg-primary" />}
              <Icon className="h-[18px] w-[18px]" />
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );

  if (isMobile) {
    return (
      <aside
        aria-hidden={!isSidebarOpen}
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(340px,88vw)] bg-card shadow-popover transition-transform duration-200 ease-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        // `inert` keeps the off-screen drawer out of the tab order.
        inert={!isSidebarOpen}
      >
        {rail}
        <div className="min-w-0 flex-1">{panelContent}</div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-shrink-0">
      {rail}
      {isSidebarOpen && (
        <Resizable
          className="border-r border-border bg-card"
          size={{ width: sidebarWidth - RAIL_WIDTH, height: '100%' }}
          minWidth={220}
          maxWidth={480}
          enable={{ right: true }}
          handleStyles={{ right: { width: 6, right: -3, zIndex: 20 } }}
          handleClasses={{ right: 'hover:bg-primary/40 active:bg-primary/60 transition-colors' }}
          onResizeStop={(_e, _dir, ref) => setSidebarWidth(ref.offsetWidth + RAIL_WIDTH)}
        >
          {panelContent}
        </Resizable>
      )}
    </aside>
  );
};
