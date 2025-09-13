import React, { createContext, useContext, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Workspace, Collection, RequestItem, KeyValueItem, RequestNode, Environment, Flow } from '../types';
import { usePersistentState } from '../hooks/usePersistentState';
import { addNode as addNodeUtil, deleteNode as deleteNodeUtil, updateNode as updateNodeUtil, findNode as findNodeUtil } from '../utils/collection';
import { useToast } from './ToastContext';

interface WorkspaceContextType {
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  globals: KeyValueItem[];
  handleGlobalsChange: (globals: KeyValueItem[]) => void;
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  setActiveEnvironmentId: (id: string | null) => void;
  handleCreateCollection: () => void;
  handleImportCollection: (collection: Collection) => void;
  addNode: (newNode: RequestNode, parentId?: string) => void;
  deleteNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updater: (node: RequestNode | Collection) => RequestNode | Collection) => void;
  findNode: (nodeId: string) => RequestNode | Collection | undefined;
  flows: Flow[];
  handleCreateFlow: (name: string) => void;
  handleUpdateFlow: (flowId: string, updates: Partial<Flow>) => void;
  handleDeleteFlow: (flowId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspace, setWorkspace] = usePersistentState<Workspace>('apiWorkspace_v2', {
    id: uuidv4(),
    name: 'My Workspace',
    collections: [],
    globals: [{id: 1, key: 'baseUrl', value: 'https://v2.jokeapi.dev', enabled: true }],
    environments: [{
      id: 'env-1',
      name: 'Example Environment',
      variables: [{id: 1, key: 'token', value: 'example-token-123', enabled: true, encode: true}]
    }],
    activeEnvironmentId: null,
    flows: [],
  });
  const { addToast } = useToast();

  const handleGlobalsChange = (globals: KeyValueItem[]) => {
    setWorkspace(ws => ({ ...ws, globals }));
  };

  const setActiveEnvironmentId = (id: string | null) => {
    setWorkspace(ws => ({ ...ws, activeEnvironmentId: id }));
  };

  const handleCreateCollection = () => {
    const newCollection: Collection = {
      id: uuidv4(),
      type: 'collection',
      name: 'New Collection',
      children: [],
    };
    setWorkspace(ws => ({ ...ws, collections: [...ws.collections, newCollection] }));
    addToast("Collection created!", "success");
  };

  const handleImportCollection = (collection: Collection) => {
    setWorkspace(ws => ({ ...ws, collections: [...ws.collections, collection] }));
  };
  
  const addNode = useCallback((newNode: RequestNode, parentId?: string) => {
    setWorkspace(ws => addNodeUtil(ws, newNode, parentId));
  }, [setWorkspace]);

  const deleteNode = useCallback((nodeId: string) => {
    setWorkspace(ws => deleteNodeUtil(ws, nodeId));
  }, [setWorkspace]);
  
  const updateNode = useCallback((nodeId: string, updater: (node: RequestNode | Collection) => RequestNode | Collection) => {
    setWorkspace(ws => updateNodeUtil(ws, nodeId, updater));
  }, [setWorkspace]);
  
  const findNode = useCallback((nodeId: string) => {
    return findNodeUtil(workspace, nodeId);
  }, [workspace]);

  const handleCreateFlow = (name: string) => {
    if (!name.trim()) {
      addToast('Flow name cannot be empty.', 'error');
      return;
    }
    const newFlow: Flow = { id: uuidv4(), name: name.trim(), nodes: [] };
    setWorkspace(ws => ({ ...ws, flows: [...(ws.flows || []), newFlow] }));
    addToast(`Flow "${name}" created!`, 'success');
  };

  const handleUpdateFlow = (flowId: string, updates: Partial<Flow>) => {
      setWorkspace(ws => ({
          ...ws,
          flows: (ws.flows || []).map(f => f.id === flowId ? { ...f, ...updates } : f),
      }));
  };
  
  const handleDeleteFlow = (flowId: string) => {
    setWorkspace(ws => ({ ...ws, flows: (ws.flows || []).filter(f => f.id !== flowId) }));
    addToast('Flow deleted.', 'info');
  };

  return (
    <WorkspaceContext.Provider value={{
      workspace, setWorkspace,
      globals: workspace.globals,
      handleGlobalsChange,
      collections: workspace.collections,
      environments: workspace.environments,
      activeEnvironmentId: workspace.activeEnvironmentId,
      setActiveEnvironmentId,
      handleCreateCollection,
      handleImportCollection,
      addNode, deleteNode, updateNode, findNode,
      flows: workspace.flows || [],
      handleCreateFlow,
      handleUpdateFlow,
      handleDeleteFlow
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
};
