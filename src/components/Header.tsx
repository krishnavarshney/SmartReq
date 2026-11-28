import React from 'react';
import { Layers, Monitor, Moon, PanelLeft, Sun, Workflow, Radar, ArrowRightLeft } from 'lucide-react';
import { Globe, LayoutHorizontal, LayoutVertical, Search, Settings, SlidersHorizontal } from './icons';
import { IconButton } from './ui/Button';
import { Tooltip, Kbd } from './ui/Tooltip';
import { AppMode, useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/DropdownMenu';
import { Logo } from './Logo';

export const MODES: { value: AppMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { value: 'single', label: 'Request', icon: <ArrowRightLeft />, hint: 'Compose and send a single request' },
  { value: 'bulk', label: 'Bulk', icon: <Layers />, hint: 'Run a request template against a dataset' },
  { value: 'flow', label: 'Flow', icon: <Workflow />, hint: 'Chain requests into a sequence' },
  { value: 'discovery', label: 'Discovery', icon: <Radar />, hint: 'Discover endpoints with AI' },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';

const ModeSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { mode, setMode } = useApp();
  return (
    <nav aria-label="Workspace mode" className={`flex items-center gap-0.5 ${className}`}>
      {MODES.map((m) => {
        const active = mode === m.value;
        return (
          <Tooltip key={m.value} content={m.hint} side="bottom">
            <button
              type="button"
              onClick={() => setMode(m.value)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-colors focus-ring [&_svg]:h-3.5 [&_svg]:w-3.5 ${
                active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              <span className={active ? 'text-primary' : ''}>{m.icon}</span>
              {m.label}
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
};

const EnvironmentSelect: React.FC = () => {
  const { environments, activeEnvironmentId, setActiveEnvironmentId } = useWorkspace();
  const { revealSidebarPanel } = useApp();
  const active = environments.find((e) => e.id === activeEnvironmentId);
  return (
    <Select
      value={activeEnvironmentId || 'none'}
      onValueChange={(v) => {
        if (v === '__manage') {
          revealSidebarPanel('environment');
          return;
        }
        setActiveEnvironmentId(v === 'none' ? null : v);
      }}
    >
      <SelectTrigger aria-label="Active environment" className="h-7 w-[168px] border-transparent bg-transparent hover:bg-accent text-[13px]">
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${active ? 'bg-success' : 'bg-muted-foreground/50'}`} />
        <SelectValue placeholder="No environment" />
      </SelectTrigger>
      <SelectContent className="w-56">
        <SelectItem value="none">No environment</SelectItem>
        {environments.map((env) => (
          <SelectItem key={env.id} value={env.id}>
            {env.name}
          </SelectItem>
        ))}
        <div className="-mx-1 my-1 h-px bg-border" />
        <SelectItem value="__manage" className="text-muted-foreground">
          Manage environments…
        </SelectItem>
      </SelectContent>
    </Select>
  );
};

const ThemeMenu: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const options = [
    { id: 'light' as const, label: 'Light', icon: <Sun /> },
    { id: 'dark' as const, label: 'Dark', icon: <Moon /> },
    { id: 'system' as const, label: 'System', icon: <Monitor /> },
  ];
  return (
    <DropdownMenu>
      <Tooltip content="Theme" side="bottom">
        <DropdownMenuTrigger asChild>
          <IconButton aria-label="Change theme" size="sm">
            <Icon className="h-4 w-4" />
          </IconButton>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent>
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onClick={(e) => setTheme(o.id, e)} className={theme === o.id ? 'text-foreground' : ''}>
            {o.icon}
            <span className="flex-1">{o.label}</span>
            {theme === o.id && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Header: React.FC = () => {
  const { setIsSettingsOpen, setIsSidebarOpen, isSidebarOpen, layout, setLayout, mode, setIsCommandPaletteOpen, revealSidebarPanel } = useApp();

  return (
    <header className="z-30 flex-shrink-0 border-b border-border bg-card">
      <div className="flex h-12 items-center gap-2 px-2 md:px-3">
        <Tooltip content={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'} shortcut={`${MOD_KEY} B`} side="bottom">
          <IconButton size="sm" onClick={() => setIsSidebarOpen((p) => !p)} aria-label="Toggle sidebar" aria-pressed={isSidebarOpen}>
            <PanelLeft className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <div className="flex items-center gap-2 pr-2 md:pr-3 md:border-r md:border-border md:mr-1">
          <Logo className="h-6 w-6" />
          <span className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:block">SmartReq</span>
        </div>

        <ModeSwitcher className="hidden md:flex" />

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden h-7 w-56 items-center gap-2 rounded-md border border-border bg-background px-2 text-[13px] text-muted-foreground transition-colors hover:border-input hover:text-foreground focus-ring lg:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 truncate text-left">Search or jump to…</span>
            <Kbd>{MOD_KEY} K</Kbd>
          </button>
          <Tooltip content="Search or run a command" shortcut={`${MOD_KEY} K`} side="bottom">
            <IconButton size="sm" className="lg:hidden" onClick={() => setIsCommandPaletteOpen(true)} aria-label="Open command palette">
              <Search className="h-4 w-4" />
            </IconButton>
          </Tooltip>

          <div className="mx-1 hidden h-5 w-px bg-border md:block" />

          <div className="hidden items-center md:flex">
            <Globe className="mr-0.5 h-3.5 w-3.5 text-muted-foreground" />
            <EnvironmentSelect />
          </div>

          {mode === 'single' && (
            <Tooltip content={layout === 'horizontal' ? 'Stack response below request' : 'Place response beside request'} side="bottom">
              <IconButton
                size="sm"
                className="hidden md:inline-flex"
                onClick={() => setLayout(layout === 'horizontal' ? 'vertical' : 'horizontal')}
                aria-label="Toggle request/response layout"
              >
                {layout === 'horizontal' ? <LayoutHorizontal className="h-4 w-4" /> : <LayoutVertical className="h-4 w-4" />}
              </IconButton>
            </Tooltip>
          )}
          <ThemeMenu />
          <Tooltip content="Settings" side="bottom">
            <IconButton size="sm" onClick={() => setIsSettingsOpen(true)} aria-label="Open settings">
              <Settings className="h-4 w-4" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      {/* Mobile: modes get their own scrollable row */}
      <div className="flex items-center gap-2 border-t border-border px-2 py-1.5 md:hidden">
        <ModeSwitcher className="no-scrollbar flex-1 overflow-x-auto" />
        <IconButton size="sm" aria-label="Environments" onClick={() => revealSidebarPanel('environment')}>
          <SlidersHorizontal className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
};
