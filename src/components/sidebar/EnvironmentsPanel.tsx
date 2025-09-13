import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Environment } from '../../types';
import { KeyValueEditor } from '../ui/KeyValueEditor';
import { Info, Plus, Trash2 } from '../icons';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Button, IconButton } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { EmptyState } from '../ui/EmptyState';

export const EnvironmentsPanel: React.FC = () => {
  const { 
    workspace, 
    setWorkspace,
    globals, 
    handleGlobalsChange,
    environments, 
    activeEnvironmentId, 
    setActiveEnvironmentId 
  } = useWorkspace();

  const [isCreating, setIsCreating] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');

  const activeEnvironment = useMemo(() => 
    environments.find(e => e.id === activeEnvironmentId), 
    [environments, activeEnvironmentId]
  );

  const handleCreateEnvironment = () => {
    if (newEnvName.trim()) {
      const newEnv: Environment = {
        id: uuidv4(),
        name: newEnvName.trim(),
        variables: [{ id: Date.now(), key: '', value: '', enabled: true }]
      };
      setWorkspace(ws => ({...ws, environments: [...ws.environments, newEnv]}));
      setActiveEnvironmentId(newEnv.id);
      setIsCreating(false);
      setNewEnvName('');
    }
  };

  const handleDeleteEnvironment = (envId: string) => {
    if (window.confirm('Are you sure you want to delete this environment?')) {
      setWorkspace(ws => ({...ws, environments: ws.environments.filter(e => e.id !== envId)}));
      if (activeEnvironmentId === envId) {
        setActiveEnvironmentId(null);
      }
    }
  };
  
  const handleActiveEnvVarChange = (vars: any) => {
    if (!activeEnvironmentId) return;
    setWorkspace(ws => ({
      ...ws,
      environments: ws.environments.map(e => e.id === activeEnvironmentId ? {...e, variables: vars} : e)
    }));
  }

  return (
    <div className="flex-grow flex flex-col h-full">
        <div className="flex flex-col p-4 border-b border-border flex-shrink-0 gap-4">
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold">Active Environment</label>
                    <Tooltip content="New Environment">
                        <IconButton size="sm" variant="ghost" onClick={() => setIsCreating(true)}><Plus className="w-4 h-4" /></IconButton>
                    </Tooltip>
                </div>
                {isCreating ? (
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            value={newEnvName}
                            onChange={e => setNewEnvName(e.target.value)}
                            placeholder="Staging..."
                            className="themed-input h-9 px-3 w-full"
                            onKeyDown={e => e.key === 'Enter' && handleCreateEnvironment()}
                        />
                        <Button size="sm" onClick={handleCreateEnvironment}>Create</Button>
                        <Button size="sm" variant="secondary" onClick={() => setIsCreating(false)}>Cancel</Button>
                    </div>
                ) : (
                    <Select
                        value={activeEnvironmentId || 'no-environment'}
                        onValueChange={value => setActiveEnvironmentId(value === 'no-environment' ? null : value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="No Environment" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="no-environment">No Environment</SelectItem>
                            {environments.map(env => (
                                <SelectItem key={env.id} value={env.id}>
                                    <div className="flex items-center justify-between w-full">
                                        <span>{env.name}</span>
                                        <IconButton size="sm" variant="ghost" className="h-6 w-6 hover:!text-destructive !-mr-2"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteEnvironment(env.id); }}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </IconButton>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Global Environment</h2>
                <Tooltip content="Variables defined here are accessible in all requests using {{variableName}} syntax. They can be overridden by Active Environment variables.">
                    <Info className="h-4 w-4 text-muted-foreground" />
                </Tooltip>
            </div>
        </div>
        <div className="p-4 overflow-auto flex-grow" key={activeEnvironmentId || 'globals'}>
            {activeEnvironment ? (
                <KeyValueEditor 
                    items={activeEnvironment.variables}
                    onItemsChange={handleActiveEnvVarChange}
                    layout="stacked"
                />
            ) : (
                 <KeyValueEditor 
                    items={globals} 
                    onItemsChange={handleGlobalsChange} 
                    keyPlaceholder="Variable Name" 
                    valuePlaceholder="Value"
                    layout="stacked"
                />
            )}
            {!activeEnvironment && (
                <EmptyState message="Select an environment to edit its variables, or edit the globals below." />
            )}
        </div>
    </div>
  );
};
