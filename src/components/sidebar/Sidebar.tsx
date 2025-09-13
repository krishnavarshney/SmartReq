import React, { useState } from 'react';
import { Resizable } from 're-resizable';
import { LogEntry, RequestItem } from '../../types';
import { LogPanel } from './LogPanel';
import { CollectionsView } from './CollectionsView';
import { EnvironmentsPanel } from './EnvironmentsPanel';
import { Tooltip } from '../ui/Tooltip';
import { FolderKanban, Globe, History } from '../icons';
import { useApp } from '../../context/AppContext';
import { useWorkspace } from '../../context/WorkspaceContext';

interface SidebarProps {
  onLogClick: (log: LogEntry) => void;
  openRequestInTab: (requestItem: RequestItem, tabName: string) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

type Panel = 'collections' | 'environment' | 'history';

const NavButton: React.FC<{ icon: React.ElementType, label: string, isActive: boolean, onClick: () => void }> = ({ icon: Icon, label, isActive, onClick }) => (
    <Tooltip content={label}>
        <button
            onClick={onClick}
            aria-label={label}
            className={`flex items-center justify-center w-12 h-12 rounded-lg relative transition-colors duration-200 ${
                isActive 
                ? 'bg-primary text-primary-foreground' 
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
        >
            <Icon className="h-5 w-5" />
        </button>
    </Tooltip>
);

export const Sidebar: React.FC<SidebarProps> = ({ onLogClick, openRequestInTab, selectedNodeId, setSelectedNodeId }) => {
  const { isSidebarOpen, setIsSidebarOpen, sidebarWidth, setSidebarWidth } = useApp();
  const { workspace, setWorkspace } = useWorkspace();
  const [activePanel, setActivePanel] = useState<Panel>('collections');
  
  const handleNavClick = (panel: Panel) => {
    setActivePanel(panel);
    if (!isSidebarOpen) {
        setIsSidebarOpen(true);
    }
  };

  return (
    <aside
      className={`
        flex-shrink-0
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? '' : 'w-16'}
      `}
      style={{ width: isSidebarOpen ? sidebarWidth : 64 }}
    >
        <div className="flex h-full">
            {/* Icon Navigation Bar */}
            <div className="w-16 flex-shrink-0 flex flex-col items-center gap-2 p-2 bg-card/80 backdrop-blur-md border-r border-border sticky top-0 z-10">
                <NavButton icon={FolderKanban} label={`Collections`} isActive={activePanel === 'collections'} onClick={() => handleNavClick('collections')} />
                <NavButton icon={Globe} label={`Environment`} isActive={activePanel === 'environment'} onClick={() => handleNavClick('environment')} />
                <NavButton icon={History} label={`History`} isActive={activePanel === 'history'} onClick={() => handleNavClick('history')} />
            </div>
            {isSidebarOpen && (
                <Resizable
                    className={`h-full bg-card/60 backdrop-blur-xl border-r border-border`}
                    size={{ width: sidebarWidth - 64, height: '100%' }}
                    minWidth={176} 
                    maxWidth={436}
                    enable={{ right: true }}
                    onResizeStop={(e, dir, ref) => {
                        setSidebarWidth(ref.offsetWidth + 64);
                    }}
                >
                    <div className={`h-full w-full flex flex-col overflow-hidden transition-opacity`}>
                        {/* Content Panel */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {activePanel === 'collections' && (
                                <CollectionsView
                                    workspace={workspace}
                                    setWorkspace={setWorkspace}
                                    openRequestInTab={openRequestInTab}
                                    selectedNodeId={selectedNodeId}
                                    setSelectedNodeId={setSelectedNodeId}
                                />
                            )}
                            {activePanel === 'environment' && (
                                <EnvironmentsPanel />
                            )}
                            {activePanel === 'history' && (
                                <LogPanel
                                    onLogClick={onLogClick}
                                />
                            )}
                        </div>
                    </div>
                </Resizable>
            )}
        </div>
    </aside>
  );
};
