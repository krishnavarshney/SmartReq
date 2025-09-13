import React, { useMemo, useState } from 'react';
import { ApiRequest, DependencyRule } from '../../types';
import { MultiSelect } from '../ui/MultiSelect';
import { TagInput } from '../ui/TagInput';
import { Button, IconButton } from '../ui/Button';
import { generateCombinations } from '../../utils/combinatorics';
import { interpolateString } from '../../utils/interpolation';
import { JsonNode } from '../response/JsonNode';
import { Info, Link } from '../icons';
import { Tooltip } from '../ui/Tooltip';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

interface BodyBuilderPanelProps {
  request: ApiRequest;
  onRequestChange: (request: ApiRequest) => void;
  onGenerateBulkData: (data: Record<string, any>[]) => void;
}

const DependencyEditor: React.FC<{
  rule: DependencyRule | undefined;
  onSave: (template: string) => void;
  onClose: () => void;
  availableVars: string[];
  dependencyKey: string;
}> = ({ rule, onSave, onClose, availableVars, dependencyKey }) => {
  const [template, setTemplate] = useState(rule?.template || '');
  
  const handleSave = () => {
    onSave(template);
    onClose();
  };

  return (
    <div className="space-y-3">
        <h3 className="font-semibold">Edit Dependency Rule for <code className="bg-muted p-1 rounded font-mono text-primary">{dependencyKey}</code></h3>
        <p className="text-xs text-muted-foreground">Use <code className="bg-muted p-1 rounded font-mono">{`{{variable}}`}</code> syntax to reference variables.</p>
        <Input 
            value={template} 
            onChange={e => setTemplate(e.target.value)}
            placeholder="e.g., User profile for {{name}}"
        />
        <div className="flex flex-wrap gap-1">
            {availableVars.map(v => (
                <button key={v} onClick={() => setTemplate(t => `${t}{{${v}}}`)} className="text-xs bg-muted px-2 py-1 rounded hover:bg-border">
                    {`{{${v}}}`}
                </button>
            ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save Rule</Button>
        </div>
    </div>
  );
};

const BaseJsonView: React.FC<{ 
    json: object; 
    rules: DependencyRule[];
    onEditRule: (key: string, anchor: HTMLElement) => void;
}> = ({ json, rules, onEditRule }) => {
    const renderNode = (data: any, path: string = ''): React.ReactNode => {
        if (typeof data !== 'object' || data === null) {
            return <JsonNode data={data} />;
        }

        const entries = Object.entries(data);
        const isArray = Array.isArray(data);

        return (
            <div>
                <span className="text-muted-foreground">{isArray ? '[' : '{'}</span>
                <div className="pl-4 border-l border-border ml-2">
                    {entries.map(([key, value]) => {
                        const currentPath = path ? `${path}.${key}` : key;
                        const rule = rules.find(r => r.key === currentPath);
                        return (
                            <div key={key} className="flex items-start gap-2 group">
                                <span className="text-sky-400 flex-shrink-0">"{key}":</span>
                                <div className="flex-grow">
                                    {rule ? <span className="text-purple-400 font-mono text-sm italic">"{rule.template}"</span> : renderNode(value, currentPath)}
                                </div>
                                <Tooltip content={`Set a dynamic value for "${currentPath}"`}>
                                    <IconButton size="sm" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={(e) => onEditRule(currentPath, e.currentTarget)}>
                                        <Link className={`h-3.5 w-3.5 ${rule ? 'text-primary' : ''}`} />
                                    </IconButton>
                                </Tooltip>
                            </div>
                        );
                    })}
                </div>
                <span className="text-muted-foreground">{isArray ? ']' : '}'}</span>
            </div>
        );
    };
    return <div className="font-mono text-sm p-4 bg-muted rounded-lg">{renderNode(json)}</div>;
};

export const BodyBuilderPanel: React.FC<BodyBuilderPanelProps> = ({ request, onRequestChange, onGenerateBulkData }) => {
    const { body, bodyBuilderVariables = {}, dependencyRules = [] } = request;
    
    const [editorState, setEditorState] = useState<{key: string, anchor: HTMLElement | null} | null>(null);

    const { availableKeys, baseJson } = useMemo(() => {
        if (body.type !== 'json' || !body.jsonBody) {
            return { availableKeys: [], baseJson: null };
        }
        try {
            const parsed = JSON.parse(body.jsonBody);
            // For now, only allow top-level keys as variables for simplicity
            const keys = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? Object.keys(parsed) : [];
            return { availableKeys: keys, baseJson: parsed };
        } catch {
            return { availableKeys: [], baseJson: null };
        }
    }, [body.jsonBody, body.type]);
    
    const selectedVariables = Object.keys(bodyBuilderVariables);
    
    const generatedCombinations = useMemo(() => {
        if (selectedVariables.length === 0) return [];
        return generateCombinations(bodyBuilderVariables);
    }, [bodyBuilderVariables]);

    const finalData = useMemo(() => {
        return generatedCombinations.map(combo => {
            const finalBody = JSON.parse(JSON.stringify(baseJson)); // Deep clone
            // Apply variables
            Object.assign(finalBody, combo);

            // Apply dependencies
            dependencyRules.forEach(rule => {
                // Simple dot notation setting. Can be improved for deep paths.
                const path = rule.key.split('.');
                let current = finalBody;
                for(let i=0; i < path.length - 1; i++) {
                    current = current[path[i]];
                    if (typeof current !== 'object') return; // Path doesn't exist
                }
                current[path[path.length - 1]] = interpolateString(rule.template, combo);
            });
            
            return finalBody;
        });
    }, [generatedCombinations, dependencyRules, baseJson]);


    const handleVariablesChange = (newVars: Record<string, string[]>) => {
        onRequestChange({ ...request, bodyBuilderVariables: newVars });
    };

    const handleSelectionChange = (selection: string[]) => {
        const newVars = { ...bodyBuilderVariables };
        // Remove deselected keys
        Object.keys(newVars).forEach(key => {
            if (!selection.includes(key)) {
                delete newVars[key];
            }
        });
        // Add new selected keys
        selection.forEach(key => {
            if (!newVars[key]) {
                newVars[key] = [];
            }
        });
        handleVariablesChange(newVars);
    };
    
    const handleRuleSave = (key: string, template: string) => {
        const newRules = [...dependencyRules.filter(r => r.key !== key)];
        if (template) {
            newRules.push({ key, template });
        }
        onRequestChange({ ...request, dependencyRules: newRules });
    };

    if (body.type !== 'json' || !baseJson) {
        return <EmptyState title="Unsupported Body Type" message="Body Builder only works with a valid JSON body. Please define a JSON body in the 'Body' tab first." />;
    }

    return (
        <div className="p-4 space-y-6">
            <section>
                <h3 className="text-md font-semibold mb-2">1. Select Variables</h3>
                <p className="text-sm text-muted-foreground mb-3">Choose the keys from your JSON body that you want to vary.</p>
                <Tooltip content="Select keys from your JSON body to use as variables for generating combinations.">
                  <MultiSelect 
                      options={availableKeys}
                      selected={selectedVariables}
                      onSelectionChange={handleSelectionChange}
                  />
                </Tooltip>
            </section>

            {selectedVariables.length > 0 && (
                <section className="animate-fade-in">
                    <h3 className="text-md font-semibold mb-2">2. Provide Values</h3>
                    <p className="text-sm text-muted-foreground mb-3">Enter the different values for each variable. Press Enter after each value.</p>
                    <div className="space-y-3">
                        {selectedVariables.map(key => (
                            <div key={key} className="grid grid-cols-4 gap-4 items-start">
                                <label className="font-semibold text-sm pt-2">{key}</label>
                                <div className="col-span-3">
                                  <Tooltip content="Type a value and press Enter or comma to add it to the list.">
                                    <TagInput 
                                        tags={bodyBuilderVariables[key] || []}
                                        onTagsChange={tags => handleVariablesChange({ ...bodyBuilderVariables, [key]: tags })}
                                    />
                                  </Tooltip>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <h3 className="text-md font-semibold mb-2 flex items-center gap-2">
                    3. Define Dependencies (Optional)
                    <Tooltip content="Define values that should change based on the generated variables. Click the link icon next to a key to create a rule.">
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </Tooltip>
                </h3>
                <BaseJsonView json={baseJson} rules={dependencyRules} onEditRule={(key, anchor) => setEditorState({ key, anchor })}/>
            </section>

            <Modal show={!!editorState} onClose={() => setEditorState(null)} size="md">
                {editorState && (
                    <DependencyEditor 
                        key={editorState.key}
                        rule={dependencyRules.find(r => r.key === editorState.key)}
                        onSave={(template) => handleRuleSave(editorState.key, template)}
                        onClose={() => setEditorState(null)}
                        availableVars={selectedVariables}
                        dependencyKey={editorState.key}
                    />
                )}
            </Modal>

            <section>
                <h3 className="text-md font-semibold mb-2">4. Generate & Run</h3>
                <p className="text-sm text-muted-foreground mb-3">A preview of the generated request bodies is shown below. When ready, send them to Bulk Mode for execution.</p>
                 <div className="max-h-80 overflow-auto rounded-lg border border-border bg-muted">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10">
                            <tr>
                                <th className="p-2 text-left font-semibold text-muted-foreground">#</th>
                                {selectedVariables.map(key => <th key={key} className="p-2 text-left font-semibold text-muted-foreground">{key}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {finalData.slice(0, 100).map((combo, index) => (
                                <tr key={index} className="hover:bg-accent/50">
                                    <td className="p-2 text-muted-foreground">{index + 1}</td>
                                    {selectedVariables.map(key => <td key={key} className="p-2 font-mono"><JsonNode data={combo[key]} /></td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {finalData.length === 0 && <div className="p-4 text-center text-muted-foreground">No combinations generated yet.</div>}
                </div>
                {finalData.length > 100 && <p className="text-xs text-muted-foreground mt-2 text-center">Preview is limited to the first 100 rows.</p>}

                <div className="mt-4 flex justify-end">
                    <Tooltip content="Generates all request body combinations and loads them into the Bulk Mode data grid for execution.">
                      <Button onClick={() => onGenerateBulkData(finalData)} disabled={finalData.length === 0}>
                          Generate & Use in Bulk Mode ({finalData.length} bodies)
                      </Button>
                    </Tooltip>
                </div>
            </section>
        </div>
    );
};