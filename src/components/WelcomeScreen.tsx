import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FilePlus, FolderPlus, Import, ChevronRight } from './icons';
import { Play } from 'lucide-react';
import { Logo } from './Logo';
import { Kbd } from './ui/Tooltip';
import { MODES, MOD_KEY } from './Header';
import { useApp } from '../context/AppContext';
import { useTabs } from '../context/TabsContext';
import { createDefaultRequest } from '../utils/collection';

interface WelcomeScreenProps {
  onCreateRequest: () => void;
  onCreateCollection: () => void;
  onImport: () => void;
}

const EXAMPLE_URL = 'https://jsonplaceholder.typicode.com/users/1';

const ActionRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  hint?: React.ReactNode;
  primary?: boolean;
  onClick: () => void;
}> = ({ icon, title, description, hint, primary, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent focus-ring"
  >
    <span
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border [&_svg]:h-4 [&_svg]:w-4 ${
        primary ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted/60 text-muted-foreground group-hover:text-foreground'
      }`}
    >
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[13px] font-medium text-foreground">{title}</span>
      <span className="block truncate text-xs text-muted-foreground">{description}</span>
    </span>
    {hint && <span className="hidden flex-shrink-0 items-center gap-1 sm:flex">{hint}</span>}
    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground" />
  </button>
);

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onCreateRequest, onCreateCollection, onImport }) => {
  const { setMode, setIsCommandPaletteOpen } = useApp();
  const { setTabs, setActiveTabId } = useTabs();

  const openExample = () => {
    const tab = {
      id: uuidv4(),
      name: 'Example: get a user',
      request: { ...createDefaultRequest(), method: 'GET' as const, url: EXAMPLE_URL },
      isDirty: false,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setMode('single');
  };

  const shortcuts = [
    { keys: [MOD_KEY, 'K'], label: 'Command palette' },
    { keys: [MOD_KEY, 'Enter'], label: 'Send request' },
    { keys: [MOD_KEY, 'S'], label: 'Save request' },
    { keys: [MOD_KEY, 'B'], label: 'Toggle sidebar' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col justify-center px-4 py-8 sm:py-12">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Welcome to SmartReq</h1>
            <p className="text-[13px] text-muted-foreground">Send a request, run it against a dataset, or chain it into a flow.</p>
          </div>
        </div>

        <section aria-labelledby="welcome-start" className="mt-6 rounded-xl border border-border bg-card p-1.5">
          <h2 id="welcome-start" className="sr-only">
            Get started
          </h2>
          <ActionRow
            primary
            icon={<FilePlus />}
            title="New request"
            description="Compose a request and send it"
            hint={
              <>
                <Kbd>{MOD_KEY}</Kbd>
                <Kbd>Enter</Kbd>
                <span className="ml-1 text-[11px] text-muted-foreground">to send</span>
              </>
            }
            onClick={onCreateRequest}
          />
          <ActionRow
            icon={<Import />}
            title="Import"
            description="OpenAPI / Swagger, Postman collection or a cURL command"
            onClick={onImport}
          />
          <ActionRow icon={<FolderPlus />} title="New collection" description="Group and save related requests" onClick={onCreateCollection} />
          <ActionRow
            icon={<Play />}
            title="Try an example"
            description={`GET ${EXAMPLE_URL.replace('https://', '')}`}
            onClick={openExample}
          />
        </section>

        <section aria-labelledby="welcome-modes" className="mt-6">
          <h2 id="welcome-modes" className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Modes
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => (m.value === 'single' ? onCreateRequest() : setMode(m.value))}
                className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-input hover:bg-accent/50 focus-ring"
              >
                <span className="mt-0.5 text-primary [&_svg]:h-4 [&_svg]:w-4">{m.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="welcome-keys" className="mt-6 hidden sm:block">
          <h2 id="welcome-keys" className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Keyboard
          </h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {shortcuts.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{s.label}</span>
                <span className="flex gap-1">
                  {s.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-ring rounded"
          >
            Open the command palette to search everything
          </button>
        </section>
      </div>
    </div>
  );
};
