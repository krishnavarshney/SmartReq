import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Moon, Sun, Eye, EyeOff, KeyRound, Palette, Database, Keyboard, Info, Upload } from 'lucide-react';
import { Download, Trash2, ExternalLink, LayoutHorizontal, LayoutVertical } from '../icons';
import { Button, IconButton } from '../ui/Button';
import { Modal, ConfirmDialog } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Kbd, Tooltip } from '../ui/Tooltip';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { setApiKey } from '../../utils/apiKey';
import { useApiKey } from '../../hooks/useApiKey';
import { useTheme } from '../../context/ThemeContext';
import { useApp, Layout } from '../../context/AppContext';
import { useWorkspace, isWorkspaceLike } from '../../context/WorkspaceContext';
import { useLog } from '../../context/LogContext';
import { useToast } from '../../context/ToastContext';
import { MOD_KEY } from '../Header';
import { Workspace } from '../../types';
import { countRequests } from '../../utils/collection';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  onClearCache: () => void;
}

const Section: React.FC<{ title: string; description?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }> = ({
  title,
  description,
  children,
  aside,
}) => (
  <section className="border-b border-border py-5 first:pt-0 last:border-b-0 last:pb-0">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {aside}
    </div>
    {children}
  </section>
);

const storageBytes = (): number => {
  try {
    let total = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) ?? '';
      total += key.length + (window.localStorage.getItem(key)?.length ?? 0);
    }
    return total * 2; // UTF-16
  } catch {
    return 0;
  }
};

const formatBytes = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: [MOD_KEY, 'K'], label: 'Open command palette' },
  { keys: [MOD_KEY, 'Enter'], label: 'Send request' },
  { keys: [MOD_KEY, 'S'], label: 'Save request' },
  { keys: [MOD_KEY, 'B'], label: 'Toggle sidebar' },
  { keys: ['F2'], label: 'Rename item in collections' },
  { keys: ['Esc'], label: 'Close dialog or menu' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ show, onClose, onClearCache }) => {
  const { theme, setTheme } = useTheme();
  const { layout, setLayout, isMobile } = useApp();
  const { workspace, setWorkspace } = useWorkspace();
  const { logs, clearLogs } = useLog();
  const { addToast } = useToast();
  const savedKey = useApiKey();

  const [section, setSection] = useState('general');
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [confirm, setConfirm] = useState<null | 'clear-all' | 'clear-history' | 'remove-key'>(null);
  const [pendingImport, setPendingImport] = useState<Workspace | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      setKeyDraft(savedKey);
      setShowKey(false);
      setImportError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const usage = useMemo(() => (show ? storageBytes() : 0), [show, workspace, logs]);
  const requestCount = useMemo(() => workspace.collections.reduce((n, c) => n + countRequests(c), 0), [workspace.collections]);

  const keyDirty = keyDraft.trim() !== savedKey;

  const saveKey = () => {
    setApiKey(keyDraft);
    addToast(keyDraft.trim() ? 'Gemini API key saved' : 'Gemini API key removed', 'success');
  };

  const exportWorkspace = () => {
    const payload = { app: 'smartreq', format: 1, exportedAt: new Date().toISOString(), workspace };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartreq-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addToast('Workspace exported', 'success');
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    try {
      const json = JSON.parse(await file.text());
      const ws = json && typeof json === 'object' && 'workspace' in json ? json.workspace : json;
      if (!isWorkspaceLike(ws)) throw new Error('This file is not a SmartReq workspace export.');
      setPendingImport({
        id: ws.id || workspace.id,
        name: ws.name || 'My Workspace',
        collections: ws.collections,
        globals: Array.isArray(ws.globals) ? ws.globals : [],
        environments: Array.isArray(ws.environments) ? ws.environments : [],
        activeEnvironmentId: ws.activeEnvironmentId ?? null,
        flows: Array.isArray(ws.flows) ? ws.flows : [],
      });
    } catch (err) {
      setImportError(err instanceof SyntaxError ? 'The file is not valid JSON.' : err instanceof Error ? err.message : 'Could not read the file.');
    }
  };

  const applyImport = () => {
    if (!pendingImport) return;
    setWorkspace(pendingImport);
    setPendingImport(null);
    addToast('Workspace imported', 'success');
  };

  const nav = [
    { value: 'general', label: 'General', icon: <Palette /> },
    { value: 'ai', label: 'AI', icon: <KeyRound /> },
    { value: 'data', label: 'Data', icon: <Database /> },
    { value: 'shortcuts', label: 'Shortcuts', icon: <Keyboard /> },
    { value: 'about', label: 'About', icon: <Info /> },
  ];

  return (
    <>
      <Modal show={show} onClose={onClose} size="3xl" title="Settings" flush>
        <Tabs value={section} onValueChange={setSection} orientation={isMobile ? 'horizontal' : 'vertical'} variant="pills" className="flex h-full min-h-0 flex-col sm:min-h-[440px] sm:flex-row">
          <div className="flex-shrink-0 border-b border-border p-2 sm:w-48 sm:border-b-0 sm:border-r">
            <TabsList aria-label="Settings sections" className="no-scrollbar overflow-x-auto">
              {nav.map((n) => (
                <TabsTrigger key={n.value} value={n.value} icon={n.icon}>
                  {n.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
            <TabsContent value="general" className="">
              <Section title="Theme" description="System follows your operating system setting.">
                <SegmentedControl
                  aria-label="Theme"
                  value={theme}
                  onChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}
                  options={[
                    { value: 'light', label: 'Light', icon: <Sun /> },
                    { value: 'dark', label: 'Dark', icon: <Moon /> },
                    { value: 'system', label: 'System', icon: <Monitor /> },
                  ]}
                />
              </Section>
              <Section title="Response layout" description="Where the response panel sits in Request mode on wide screens.">
                <SegmentedControl
                  aria-label="Response layout"
                  value={layout}
                  onChange={(v) => setLayout(v as Layout)}
                  options={[
                    { value: 'horizontal', label: 'Side by side', icon: <LayoutHorizontal /> },
                    { value: 'vertical', label: 'Stacked', icon: <LayoutVertical /> },
                  ]}
                />
              </Section>
            </TabsContent>

            <TabsContent value="ai" className="">
              <Section
                title="Gemini API key"
                description={
                  <>
                    Powers response insights, script and test generation, and endpoint discovery. The key is stored only in this browser and sent only to
                    Google’s Gemini API.
                  </>
                }
                aside={savedKey ? <Badge tone="success" dot>Saved</Badge> : <Badge tone="neutral">Not set</Badge>}
              >
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (keyDirty) saveKey();
                  }}
                >
                  <div className="relative min-w-0 flex-1">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={keyDraft}
                      onChange={(e) => setKeyDraft(e.target.value)}
                      placeholder="AIza…"
                      aria-label="Gemini API key"
                      autoComplete="off"
                      spellCheck={false}
                      className="pr-9 font-mono"
                    />
                    <Tooltip content={showKey ? 'Hide key' : 'Show key'}>
                      <IconButton
                        size="xs"
                        aria-label={showKey ? 'Hide key' : 'Show key'}
                        onClick={() => setShowKey((s) => !s)}
                        className="!absolute right-1 top-1/2 -translate-y-1/2"
                      >
                        {showKey ? <EyeOff /> : <Eye />}
                      </IconButton>
                    </Tooltip>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={!keyDirty || !keyDraft.trim()} className="flex-1 sm:flex-none">
                      Save key
                    </Button>
                    {savedKey && (
                      <Button variant="secondary" onClick={() => setConfirm('remove-key')} className="flex-1 sm:flex-none">
                        Remove
                      </Button>
                    )}
                  </div>
                </form>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 rounded text-xs text-primary hover:underline focus-ring"
                >
                  Get a key from Google AI Studio <ExternalLink className="h-3 w-3" />
                </a>
              </Section>
            </TabsContent>

            <TabsContent value="data" className="">
              <Section
                title="Workspace"
                description={
                  <>
                    {workspace.collections.length} collection{workspace.collections.length === 1 ? '' : 's'}, {requestCount} request
                    {requestCount === 1 ? '' : 's'}, {workspace.environments.length} environment{workspace.environments.length === 1 ? '' : 's'}. Everything is
                    stored in this browser ({formatBytes(usage)} used).
                  </>
                }
              >
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={exportWorkspace}>
                    <Download className="h-4 w-4" /> Export JSON
                  </Button>
                  <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Import JSON
                  </Button>
                  <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
                </div>
                {importError && (
                  <p role="alert" className="mt-2 text-xs text-destructive-text">
                    {importError}
                  </p>
                )}
              </Section>
              <Section title="History" description={`${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}. The latest 100 requests are kept.`}>
                <Button variant="secondary" onClick={() => setConfirm('clear-history')} disabled={logs.length === 0}>
                  <Trash2 className="h-4 w-4" /> Clear history
                </Button>
              </Section>
              <Section title="Reset" description="Delete all collections, environments, history, tabs, settings and your API key from this browser.">
                <Button variant="destructive" onClick={() => setConfirm('clear-all')}>
                  Clear all data
                </Button>
              </Section>
            </TabsContent>

            <TabsContent value="shortcuts" className="">
              <Section title="Keyboard shortcuts" description={`${MOD_KEY === '⌘' ? 'Cmd' : 'Ctrl'} works anywhere, including inside text fields.`}>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {SHORTCUTS.map((s) => (
                    <li key={s.label} className="flex h-10 items-center justify-between gap-3 px-3 text-[13px]">
                      <span className="text-foreground">{s.label}</span>
                      <span className="flex gap-1">
                        {s.keys.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            </TabsContent>

            <TabsContent value="about" className="">
              <Section title="SmartReq" description="A browser-based API client for single requests, data-driven bulk runs, request flows and endpoint discovery.">
                <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                  <li>Requests are sent directly from your browser, so the target API must allow cross-origin (CORS) requests.</li>
                  <li>Browsers hide some response details, such as Set-Cookie headers and exact network timings, from web pages.</li>
                  <li>Your data never leaves this browser unless you export it.</li>
                </ul>
                <a
                  href="https://github.com/krishnavarshney/SmartReq"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 rounded text-xs text-primary hover:underline focus-ring"
                >
                  Source on GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </Section>
            </TabsContent>
          </div>
        </Tabs>
      </Modal>

      <ConfirmDialog
        show={confirm === 'remove-key'}
        title="Remove Gemini API key?"
        description="AI features will stop working until you add a key again."
        confirmLabel="Remove key"
        destructive
        onConfirm={() => {
          setApiKey('');
          setKeyDraft('');
          setConfirm(null);
          addToast('Gemini API key removed', 'info');
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        show={confirm === 'clear-history'}
        title="Clear history?"
        description="All request history will be removed. Saved requests are not affected."
        confirmLabel="Clear history"
        destructive
        onConfirm={() => {
          clearLogs();
          setConfirm(null);
          addToast('History cleared', 'info');
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        show={confirm === 'clear-all'}
        title="Clear all data?"
        description="This permanently deletes every collection, environment, history entry and setting stored in this browser. Export your workspace first if you want to keep it."
        confirmLabel="Delete everything"
        destructive
        onConfirm={() => {
          setConfirm(null);
          onClearCache();
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        show={!!pendingImport}
        title="Replace current workspace?"
        description={
          pendingImport && (
            <>
              The file contains {pendingImport.collections.length} collection{pendingImport.collections.length === 1 ? '' : 's'} and{' '}
              {pendingImport.environments.length} environment{pendingImport.environments.length === 1 ? '' : 's'}. Your current collections, environments, globals and
              flows will be replaced. History is kept.
            </>
          )
        }
        confirmLabel="Replace workspace"
        destructive
        onConfirm={applyImport}
        onCancel={() => setPendingImport(null)}
      />
    </>
  );
};
