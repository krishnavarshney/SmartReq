import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Environment, KeyValueItem } from '../../types';
import { KeyValueEditor, looksSecret } from '../ui/KeyValueEditor';
import { Plus, Trash2, Globe } from '../icons';
import { Check, CopyPlus, MoreHorizontal, Pencil, Earth } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Button, IconButton } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/Modal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { getUniqueNodeName } from '../../utils/collection';

const GLOBALS = '__globals';

const countVars = (vars: KeyValueItem[]) => vars.filter((v) => v.key.trim()).length;

const NameInput: React.FC<{ initial?: string; placeholder?: string; onCommit: (name: string) => void; onCancel: () => void }> = ({
  initial = '',
  placeholder,
  onCommit,
  onCancel,
}) => {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    if (value.trim()) onCommit(value.trim());
    else onCancel();
  };
  return (
    <input
      ref={ref}
      value={value}
      placeholder={placeholder}
      aria-label="Environment name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          e.stopPropagation();
          done.current = true;
          onCancel();
        }
      }}
      className="h-6 min-w-0 flex-1 rounded border border-ring bg-background px-1.5 text-[13px] text-foreground outline-none ring-2 ring-ring/25 placeholder:text-muted-foreground/70"
    />
  );
};

export const EnvironmentsPanel: React.FC = () => {
  const { setWorkspace, globals, handleGlobalsChange, environments, activeEnvironmentId, setActiveEnvironmentId } = useWorkspace();

  const [selectedId, setSelectedId] = useState<string>(activeEnvironmentId ?? GLOBALS);
  const [isCreating, setIsCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Environment | null>(null);

  // Selected environment disappeared (deleted elsewhere): fall back to globals.
  useEffect(() => {
    if (selectedId !== GLOBALS && !environments.some((e) => e.id === selectedId)) setSelectedId(GLOBALS);
  }, [environments, selectedId]);

  const selectedEnv = environments.find((e) => e.id === selectedId);

  const updateEnv = (id: string, updates: Partial<Environment>) =>
    setWorkspace((ws) => ({ ...ws, environments: ws.environments.map((e) => (e.id === id ? { ...e, ...updates } : e)) }));

  const createEnv = (name: string) => {
    const env: Environment = { id: uuidv4(), name: getUniqueNodeName(environments, name), variables: [{ id: Date.now(), key: '', value: '', enabled: true }] };
    setWorkspace((ws) => ({ ...ws, environments: [...(ws.environments ?? []), env] }));
    setIsCreating(false);
    setSelectedId(env.id);
    if (!activeEnvironmentId) setActiveEnvironmentId(env.id);
  };

  const duplicateEnv = (env: Environment) => {
    const copy: Environment = {
      id: uuidv4(),
      name: getUniqueNodeName(environments, `${env.name} copy`),
      variables: env.variables.map((v, i) => ({ ...v, id: Date.now() + i })),
    };
    setWorkspace((ws) => {
      const idx = ws.environments.findIndex((e) => e.id === env.id);
      const next = [...ws.environments];
      next.splice(idx + 1, 0, copy);
      return { ...ws, environments: next };
    });
    setSelectedId(copy.id);
    setRenamingId(copy.id);
  };

  const confirmDelete = () => {
    const env = pendingDelete;
    setPendingDelete(null);
    if (!env) return;
    setWorkspace((ws) => ({
      ...ws,
      environments: ws.environments.filter((e) => e.id !== env.id),
      activeEnvironmentId: ws.activeEnvironmentId === env.id ? null : ws.activeEnvironmentId,
    }));
  };

  const rowClass = (selected: boolean) =>
    `group relative flex h-8 cursor-pointer items-center gap-2 rounded-md pl-2 pr-1 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
      selected ? 'bg-accent text-foreground' : 'text-foreground/90 hover:bg-accent/60'
    }`;

  const onRowKey = (e: React.KeyboardEvent, id: string) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedId(id);
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = Array.from(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[data-env-row]') ?? []);
      const i = rows.indexOf(e.currentTarget as HTMLElement);
      rows[e.key === 'ArrowDown' ? Math.min(i + 1, rows.length - 1) : Math.max(i - 1, 0)]?.focus();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 flex-shrink-0 items-center justify-between gap-2 border-b border-border pl-3 pr-1.5">
        <h2 className="truncate text-[13px] font-semibold text-foreground">Environments</h2>
        <Tooltip content="New environment" side="bottom">
          <IconButton size="sm" aria-label="New environment" onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>

      {/* Environment list */}
      <div className="max-h-[45%] flex-shrink-0 overflow-y-auto border-b border-border p-1.5" role="listbox" aria-label="Environments">
        <div
          data-env-row
          role="option"
          aria-selected={selectedId === GLOBALS}
          tabIndex={0}
          onClick={() => setSelectedId(GLOBALS)}
          onKeyDown={(e) => onRowKey(e, GLOBALS)}
          className={rowClass(selectedId === GLOBALS)}
        >
          <Earth className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">Globals</span>
          <span className="px-1 text-[11px] tabular-nums text-muted-foreground">{countVars(globals)}</span>
        </div>

        {environments.length > 0 && <div className="mx-2 my-1 h-px bg-border" />}

        {environments.map((env) => {
          const isActive = env.id === activeEnvironmentId;
          return (
            <div
              key={env.id}
              data-env-row
              role="option"
              aria-selected={selectedId === env.id}
              tabIndex={0}
              onClick={() => setSelectedId(env.id)}
              onDoubleClick={() => setRenamingId(env.id)}
              onKeyDown={(e) => {
                if (e.key === 'F2') setRenamingId(env.id);
                else onRowKey(e, env.id);
              }}
              className={rowClass(selectedId === env.id)}
            >
              <Tooltip content={isActive ? 'Active environment' : 'Set as active'} side="right">
                <button
                  type="button"
                  aria-label={isActive ? `${env.name} is active` : `Set ${env.name} as active`}
                  aria-pressed={isActive}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveEnvironmentId(isActive ? null : env.id);
                  }}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full focus-ring"
                >
                  <span
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors ${
                      isActive ? 'border-success bg-success' : 'border-muted-foreground/50 group-hover:border-muted-foreground'
                    }`}
                  >
                    {isActive && <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />}
                  </span>
                </button>
              </Tooltip>
              {renamingId === env.id ? (
                <NameInput
                  initial={env.name}
                  onCommit={(name) => {
                    updateEnv(env.id, { name });
                    setRenamingId(null);
                  }}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate" title={env.name}>
                  {env.name}
                </span>
              )}
              {renamingId !== env.id && (
                <>
                  <span className="px-1 text-[11px] tabular-nums text-muted-foreground group-hover:hidden group-has-[[aria-expanded=true]]:hidden">
                    {countVars(env.variables)}
                  </span>
                  <span className="hidden group-hover:flex has-[[aria-expanded=true]]:flex" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Actions for ${env.name}`}
                        tabIndex={-1}
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/60 hover:text-foreground focus-ring aria-expanded:bg-background/60"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-48">
                        <DropdownMenuItem onClick={() => setActiveEnvironmentId(isActive ? null : env.id)}>
                          <Check /> {isActive ? 'Deactivate' : 'Set as active'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRenamingId(env.id)}>
                          <Pencil /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateEnv(env)}>
                          <CopyPlus /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onClick={() => setPendingDelete(env)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </>
              )}
            </div>
          );
        })}

        {isCreating && (
          <div className="flex h-8 items-center gap-2 pl-2 pr-1">
            <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <NameInput placeholder="e.g. Staging" onCommit={createEnv} onCancel={() => setIsCreating(false)} />
          </div>
        )}

        {environments.length === 0 && !isCreating && (
          <div className="px-2 pb-1 pt-2">
            <p className="text-xs text-muted-foreground">Environments hold values that change between targets, like local, staging and production.</p>
            <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => setIsCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> New environment
            </Button>
          </div>
        )}
      </div>

      {/* Variable editor */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-10 flex-shrink-0 items-center gap-2 px-3">
          <h3 className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {selectedEnv ? selectedEnv.name : 'Global variables'}
          </h3>
          {selectedEnv &&
            (selectedEnv.id === activeEnvironmentId ? (
              <Badge tone="success" dot>
                Active
              </Badge>
            ) : (
              <Button size="xs" variant="ghost" onClick={() => setActiveEnvironmentId(selectedEnv.id)}>
                Set active
              </Button>
            ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" key={selectedId}>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            {selectedEnv ? (
              <>
                Used when this environment is active. Values override globals with the same name. Reference them as{' '}
                <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">{'{{name}}'}</code>.
              </>
            ) : (
              <>
                Available in every request as <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">{'{{name}}'}</code>. An active
                environment can override them.
              </>
            )}
          </p>
          {selectedEnv ? (
            <KeyValueEditor
              items={selectedEnv.variables}
              onItemsChange={(variables) => updateEnv(selectedEnv.id, { variables })}
              isSecret={looksSecret}
              keyPlaceholder="Variable"
              valuePlaceholder="Value"
              layout="stacked"
              showBulkEdit
            />
          ) : globals.length === 0 ? (
            <EmptyState compact icon={<Earth />} message="No global variables yet.">
              <Button size="sm" variant="secondary" onClick={() => handleGlobalsChange([{ id: Date.now(), key: '', value: '', enabled: true }])}>
                <Plus className="h-3.5 w-3.5" /> Add variable
              </Button>
            </EmptyState>
          ) : (
            <KeyValueEditor
              items={globals}
              onItemsChange={handleGlobalsChange}
              isSecret={looksSecret}
              keyPlaceholder="Variable"
              valuePlaceholder="Value"
              layout="stacked"
              showBulkEdit
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        show={!!pendingDelete}
        title={pendingDelete ? `Delete “${pendingDelete.name}”?` : ''}
        description={
          pendingDelete && (
            <>
              Its {countVars(pendingDelete.variables)} variable{countVars(pendingDelete.variables) === 1 ? '' : 's'} will be removed.
              {pendingDelete.id === activeEnvironmentId && ' Requests will run without an environment until you pick another one.'}
            </>
          )
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
