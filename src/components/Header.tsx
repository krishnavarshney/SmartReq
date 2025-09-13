import React, { useEffect, useMemo, useState } from 'react';
import { LayoutHorizontal, LayoutVertical, Menu, Rocket, Settings } from './icons';
import { IconButton } from './ui/Button';
import { Tooltip } from './ui/Tooltip';
import { useApp } from '../context/AppContext';
import { ThemeSwitcher } from './ThemeSwitcher';
import { CommandPalette, CommandItem } from './ui/CommandPalette';
import { useWorkspace } from '../context/WorkspaceContext';

export const Header: React.FC = () => {
  const { setIsSettingsOpen, setIsSidebarOpen, layout, setLayout } = useApp();
  const { workspace } = useWorkspace();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const paletteItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      { id: 'toggle-sidebar', title: 'Toggle Sidebar', group: 'View', shortcut: '⌘/Ctrl+B', action: () => setIsSidebarOpen(prev => !prev) },
      { id: 'open-settings', title: 'Open Settings', group: 'App', shortcut: 'S', action: () => setIsSettingsOpen(true) },
      { id: 'layout-horizontal', title: 'Layout: Horizontal', group: 'View', action: () => setLayout('horizontal') },
      { id: 'layout-vertical', title: 'Layout: Vertical', group: 'View', action: () => setLayout('vertical') },
    ];
    workspace.collections.forEach((c) => {
      items.push({ id: `collection-${c.id}`, title: `Open Collection: ${c.name}`, group: 'Collections', action: () => setIsSidebarOpen(true) });
    });
    return items;
  }, [workspace.collections, setIsSidebarOpen, setIsSettingsOpen, setLayout]);
  
  return (
    <header className="flex items-center justify-between px-3 md:px-4 h-14 bg-card/80 backdrop-blur-lg flex-shrink-0 z-20">
      <div className="flex items-center gap-3">
        <IconButton variant="ghost" onClick={() => setIsSidebarOpen(prev => !prev)} aria-label="Toggle workspace menu">
            <Menu className="h-5 w-5" />
        </IconButton>
        <div className="flex items-center gap-2">
            <div className="h-7 w-7 bg-primary rounded-lg flex items-center justify-center">
                <Rocket className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground tracking-tight hidden sm:block">
                SmartReq
            </h1>
        </div>
      </div>
       <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center px-3 py-1.5 rounded-md bg-background/60 border border-border focus-ring motion-base hover:elev-1 hover:-translate-y-[1px]">
          <span className="text-xs text-muted-foreground">Search / Command</span>
          <span className="ml-3 text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5">Ctrl/Cmd K</span>
        </div>
        <ThemeSwitcher />
        <div className="hidden md:flex items-center gap-1 p-1 bg-muted rounded-md">
            <Tooltip content="Vertical Layout">
                <IconButton size="sm" variant={layout === 'vertical' ? 'secondary' : 'ghost'} onClick={() => setLayout('vertical')}>
                    <LayoutVertical className="h-4 w-4" />
                </IconButton>
            </Tooltip>
              <Tooltip content="Horizontal Layout">
                <IconButton size="sm" variant={layout === 'horizontal' ? 'secondary' : 'ghost'} onClick={() => setLayout('horizontal')}>
                    <LayoutHorizontal className="h-4 w-4" />
                </IconButton>
            </Tooltip>
        </div>
        <IconButton variant="ghost" onClick={() => setIsSettingsOpen(true)} aria-label="Open Settings" className="transition-transform duration-200 hover:rotate-12">
            <Settings className="h-5 w-5" />
        </IconButton>
      </div>
      <CommandPalette open={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} items={paletteItems} />
    </header>
  );
};