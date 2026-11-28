import React, { useMemo } from 'react';
import { EmptyState } from '../../ui/EmptyState';
import { Link } from '../../icons';
import { KeyValueItem } from '../../../types';
import { extractVariableNames, syncPathVariables } from '../../../utils/http-data';
import { resolveVariable } from '../../../utils/interpolation';
import { VARIABLE_SOURCE_LABEL, VARIABLE_TONE } from '../../ui/VariablePreviewInput';
import { VarField } from '../VarField';

interface PathVariablesPanelProps {
  url: string;
  /** First data row in bulk mode; its columns resolve `{{variables}}`. */
  data: Record<string, string> | undefined;
  globals: KeyValueItem[];
  /** Values for `:name` segments. */
  pathVariables?: KeyValueItem[];
  onPathVariablesChange?: (items: KeyValueItem[]) => void;
}

const SectionTitle: React.FC<{ title: string; hint: React.ReactNode }> = ({ title, hint }) => (
  <div className="mb-2">
    <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
    <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
  </div>
);

export const PathVariablesPanel: React.FC<PathVariablesPanelProps> = ({ url, data, globals, pathVariables, onPathVariablesChange }) => {
  const rows = useMemo(() => syncPathVariables(url, pathVariables), [url, pathVariables]);
  const urlVariables = useMemo(() => extractVariableNames(url).map((name) => resolveVariable(name, globals, data)), [url, globals, data]);

  if (rows.length === 0 && urlVariables.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Link />}
        title="No variables in the URL"
        message={
          <>
            Add a path variable like <code className="font-mono text-foreground">/users/:id</code> or an environment variable like{' '}
            <code className="font-mono text-foreground">{'{{baseUrl}}'}</code>.
          </>
        }
      />
    );
  }

  const setValue = (key: string, value: string) => onPathVariablesChange?.(rows.map((r) => (r.key === key ? { ...r, value } : r)));

  return (
    <div className="space-y-6 p-3">
      {rows.length > 0 && (
        <section>
          <SectionTitle title="Path variables" hint={<>Values replace the matching <code className="font-mono">:name</code> segment and are URL-encoded.</>} />
          <div className="overflow-hidden rounded-md border border-border">
            {rows.map((row) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 border-b border-border px-2 py-1.5 last:border-b-0">
                <label htmlFor={`pv-${row.key}`} className="truncate font-mono text-xs text-primary">
                  :{row.key}
                </label>
                {onPathVariablesChange ? (
                  <VarField id={`pv-${row.key}`} value={row.value} onChange={(v) => setValue(row.key, v)} variables={globals} placeholder="Value" aria-label={`Value for :${row.key}`} />
                ) : (
                  <span className="truncate font-mono text-xs">{row.value || <span className="text-muted-foreground">Not set</span>}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {urlVariables.length > 0 && (
        <section>
          <SectionTitle title="Variables in URL" hint="Resolved from the active environment, globals and (in bulk mode) the first data row." />
          <div className="overflow-hidden rounded-md border border-border">
            {urlVariables.map((v) => (
              <div key={v.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2 border-b border-border px-2 py-2 last:border-b-0">
                <span className="truncate font-mono text-xs">{`{{${v.name}}}`}</span>
                <span className={`truncate font-mono text-xs ${v.source === 'unresolved' ? 'italic text-muted-foreground' : 'text-foreground'}`} title={v.value}>
                  {v.source === 'unresolved' ? 'Not defined' : v.value || '(empty)'}
                </span>
                <span className={`rounded px-1.5 py-px text-[10px] font-medium ${VARIABLE_TONE[v.source]}`}>{VARIABLE_SOURCE_LABEL[v.source]}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
