import React, { useMemo, useState } from 'react';
import { ApiRequest, DependencyRule } from '../../../types';
import { TagInput } from '../../ui/TagInput';
import { Button, IconButton } from '../../ui/Button';
import { countCombinations, listJsonPaths, planBodyCombinations } from '../../../utils/combinatorics';
import { validateJsonTemplate } from '../../../utils/http-data';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/Select';
import { ConfirmDialog } from '../../ui/Modal';
import { useBulk } from '../../../context/BulkContext';

interface BodyBuilderPanelProps {
  request: ApiRequest;
  onRequestChange: (request: ApiRequest) => void;
  onGenerateBulkData: (data: Record<string, any>[]) => void;
}

const MAX_ROWS = 5000;
const PREVIEW_ROWS = 50;

const Step: React.FC<{ n: number; title: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ n, title, hint, children }) => (
  <section className="space-y-2">
    <div>
      <h3 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">{n}</span>
        {title}
      </h3>
      {hint && <p className="ml-7 mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
    <div className="ml-7">{children}</div>
  </section>
);

const typeLabel = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

const display = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

export const BodyBuilderPanel: React.FC<BodyBuilderPanelProps> = ({ request, onRequestChange, onGenerateBulkData }) => {
  const { body, bodyBuilderVariables = {}, dependencyRules = [] } = request;
  const { bulkData, setBulkRequest } = useBulk();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newRule, setNewRule] = useState<DependencyRule>({ key: '', template: '' });

  const baseJson = useMemo(() => {
    if (body.type !== 'json' || !body.jsonBody?.trim() || validateJsonTemplate(body.jsonBody)) return null;
    try {
      const parsed = JSON.parse(body.jsonBody);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null; // contains {{variables}}; the builder needs a concrete example body
    }
  }, [body.type, body.jsonBody]);

  const availableKeys = useMemo(() => (baseJson ? Object.keys(baseJson) : []), [baseJson]);
  const selected = useMemo(() => Object.keys(bodyBuilderVariables).filter((k) => availableKeys.includes(k)), [bodyBuilderVariables, availableKeys]);
  const varsInUse = useMemo(() => Object.fromEntries(selected.map((k) => [k, bodyBuilderVariables[k] || []])), [selected, bodyBuilderVariables]);
  const total = countCombinations(varsInUse);
  const tooMany = total > MAX_ROWS;

  const rulePaths = useMemo(() => (baseJson ? listJsonPaths(baseJson).filter((p) => !selected.includes(p.split('.')[0]) && !dependencyRules.some((r) => r.key === p)) : []), [
    baseJson,
    selected,
    dependencyRules,
  ]);

  const preview = useMemo(
    () => (baseJson && total > 0 ? planBodyCombinations(baseJson, varsInUse, dependencyRules, Math.min(PREVIEW_ROWS, MAX_ROWS)) : null),
    [baseJson, varsInUse, dependencyRules, total]
  );

  const setVariables = (next: Record<string, string[]>) => onRequestChange({ ...request, bodyBuilderVariables: next });

  const toggleKey = (key: string) => {
    const next = { ...bodyBuilderVariables };
    if (key in next) delete next[key];
    else next[key] = baseJson && baseJson[key] !== undefined && typeof baseJson[key] !== 'object' ? [String(baseJson[key])] : [];
    setVariables(next);
  };

  const addRule = () => {
    if (!newRule.key || !newRule.template) return;
    onRequestChange({ ...request, dependencyRules: [...dependencyRules.filter((r) => r.key !== newRule.key), newRule] });
    setNewRule({ key: '', template: '' });
  };

  const sendToBulk = () => {
    if (!baseJson) return;
    const plan = planBodyCombinations(baseJson, varsInUse, dependencyRules, MAX_ROWS);
    setBulkRequest({ ...request, body: { ...request.body, type: 'json', jsonBody: plan.template } });
    onGenerateBulkData(plan.rows);
    setConfirmOpen(false);
  };

  if (!baseJson) {
    return (
      <EmptyState
        compact
        icon={<Layers />}
        title="Needs a JSON object body"
        message={
          body.type !== 'json'
            ? 'The Body Builder generates variations of a JSON body. Set the body type to JSON and add an example object in the Body tab.'
            : 'Add a valid example JSON object in the Body tab (without {{variables}}); its fields become the inputs here.'
        }
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-6 p-4">
      <p className="text-xs text-muted-foreground">
        Generate every combination of values for some fields of the body, then run them all in Bulk mode.
      </p>

      <Step n={1} title="Pick fields to vary" hint="Top-level fields of the example body.">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fields to vary">
          {availableKeys.map((key) => {
            const on = selected.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleKey(key)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 font-mono text-xs transition-colors focus-ring ${
                  on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {key}
                <span className="font-sans text-[10px] opacity-70">{typeLabel(baseJson[key])}</span>
              </button>
            );
          })}
        </div>
      </Step>

      {selected.length > 0 && (
        <Step n={2} title="Values" hint="Press Enter or comma after each value; paste a comma-separated list to add many. Numbers and booleans keep their type.">
          <div className="space-y-2">
            {selected.map((key) => (
              <div key={key} className="grid gap-1.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start sm:gap-3">
                <label className="truncate pt-1.5 font-mono text-xs text-foreground">
                  {key} <span className="text-muted-foreground">({(bodyBuilderVariables[key] || []).length})</span>
                </label>
                <TagInput
                  tags={bodyBuilderVariables[key] || []}
                  onTagsChange={(tags) => setVariables({ ...bodyBuilderVariables, [key]: tags })}
                  aria-label={`Values for ${key}`}
                />
              </div>
            ))}
          </div>
        </Step>
      )}

      <Step
        n={selected.length > 0 ? 3 : 2}
        title="Derived fields (optional)"
        hint={<>Set another field from a template, e.g. <code className="font-mono">{'Profile of {{name}}'}</code>, using the fields you vary.</>}
      >
        <div className="space-y-2">
          {dependencyRules.map((rule) => (
            <div key={rule.key} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
              <span className="min-w-0 flex-shrink-0 truncate font-mono text-xs text-foreground">{rule.key}</span>
              <span className="text-xs text-muted-foreground">=</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-info-text">{rule.template}</span>
              <IconButton
                size="xs"
                aria-label={`Remove rule for ${rule.key}`}
                onClick={() => onRequestChange({ ...request, dependencyRules: dependencyRules.filter((r) => r.key !== rule.key) })}
                className="hover:text-destructive-text"
              >
                <Trash2 />
              </IconButton>
            </div>
          ))}
          {rulePaths.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={newRule.key} onValueChange={(key) => setNewRule((r) => ({ ...r, key }))}>
                <SelectTrigger className="sm:w-48" aria-label="Field to derive">
                  <SelectValue placeholder="Field" />
                </SelectTrigger>
                <SelectContent>
                  {rulePaths.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="font-mono text-xs">{p}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newRule.template}
                onChange={(e) => setNewRule((r) => ({ ...r, template: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addRule()}
                placeholder={selected[0] ? `e.g. Hello {{${selected[0]}}}` : 'Template'}
                className="font-mono text-xs"
                aria-label="Template"
              />
              <Button variant="secondary" onClick={addRule} disabled={!newRule.key || !newRule.template}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          )}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setNewRule((r) => ({ ...r, template: `${r.template}{{${v}}}` }))}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </Step>

      <Step n={selected.length > 0 ? 4 : 3} title="Preview and run">
        {total === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            {selected.length === 0 ? 'Pick at least one field to vary.' : 'Add values to see the combinations.'}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="max-h-72 overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="w-10 px-2 py-1.5 text-left font-medium text-muted-foreground">#</th>
                    {[...selected, ...dependencyRules.map((r) => r.key)].map((key) => (
                      <th key={key} className="px-2 py-1.5 text-left font-mono font-medium text-muted-foreground">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview?.bodies.map((b, index) => (
                    <tr key={index}>
                      <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{index + 1}</td>
                      {selected.map((key) => (
                        <td key={key} className="max-w-[240px] truncate px-2 py-1.5 font-mono">
                          {display(b[key])}
                        </td>
                      ))}
                      {dependencyRules.map((r) => (
                        <td key={r.key} className="max-w-[240px] truncate px-2 py-1.5 font-mono text-info-text">
                          {display(r.key.split('.').reduce<any>((acc, part) => acc?.[part], b))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-xs ${tooMany ? 'text-warning-text' : 'text-muted-foreground'}`}>
                {tooMany
                  ? `${total.toLocaleString()} combinations is more than the ${MAX_ROWS.toLocaleString()} row limit. Remove some values.`
                  : `${total.toLocaleString()} combination${total === 1 ? '' : 's'}${total > PREVIEW_ROWS ? `, showing the first ${PREVIEW_ROWS}` : ''}.`}
              </p>
              <Button onClick={() => (bulkData.length > 0 ? setConfirmOpen(true) : sendToBulk())} disabled={tooMany}>
                <Layers className="h-3.5 w-3.5" />
                Send {total.toLocaleString()} to Bulk
              </Button>
            </div>
          </div>
        )}
      </Step>

      <ConfirmDialog
        show={confirmOpen}
        title="Replace the Bulk run?"
        description={`Bulk mode already has ${bulkData.length} data row${bulkData.length === 1 ? '' : 's'}. They will be replaced by ${total.toLocaleString()} generated rows, and the Bulk request by this request with a templated body.`}
        confirmLabel="Replace"
        onConfirm={sendToBulk}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
