import React, { createContext, useContext, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Workspace, Collection, KeyValueItem, RequestNode, Environment, Flow } from '../types';
import { usePersistentState } from '../hooks/usePersistentState';
import {
  addNode as addNodeUtil,
  deleteNode as deleteNodeUtil,
  updateNode as updateNodeUtil,
  findNode as findNodeUtil,
  duplicateNode as duplicateNodeUtil,
  moveNode as moveNodeUtil,
  getUniqueNodeName,
  DropPosition,
} from '../utils/collection';
import { useToast } from './ToastContext';
import { useApp } from './AppContext';

interface WorkspaceContextType {
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  globals: KeyValueItem[];
  handleGlobalsChange: (globals: KeyValueItem[]) => void;
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  setActiveEnvironmentId: (id: string | null) => void;
  /** Creates an empty collection, reveals it in the sidebar and starts renaming it. Returns its id. */
  handleCreateCollection: () => string;
  handleImportCollection: (collection: Collection) => void;
  addNode: (newNode: RequestNode, parentId?: string) => void;
  deleteNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updater: (node: RequestNode | Collection) => RequestNode | Collection) => void;
  findNode: (nodeId: string) => RequestNode | Collection | undefined;
  duplicateNode: (nodeId: string) => string | null;
  moveNode: (dragId: string, targetId: string, position: DropPosition) => void;
  /** Tree node currently being renamed inline in the sidebar. */
  renamingNodeId: string | null;
  setRenamingNodeId: (id: string | null) => void;
  flows: Flow[];
  handleCreateFlow: (name: string) => void;
  handleUpdateFlow: (flowId: string, updates: Partial<Flow>) => void;
  handleDeleteFlow: (flowId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const createEmptyWorkspace = (): Workspace => ({
  id: uuidv4(),
  name: 'My Workspace',
  collections: [],
  globals: [],
  environments: [],
  activeEnvironmentId: null,
  flows: [],
});

/** Loose structural check used when importing a workspace file. */
export const isWorkspaceLike = (value: unknown): value is Workspace => {
  if (!value || typeof value !== 'object') return false;
  const ws = value as Partial<Workspace>;
  return Array.isArray(ws.collections) && (ws.environments === undefined || Array.isArray(ws.environments));
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspace, setWorkspace] = usePersistentState<Workspace>('apiWorkspace_v2', createEmptyWorkspace());
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const { addToast } = useToast();
  const { revealSidebarPanel, isMobile } = useApp();

  const handleGlobalsChange = useCallback((globals: KeyValueItem[]) => setWorkspace((ws) => ({ ...ws, globals })), [setWorkspace]);

  const setActiveEnvironmentId = useCallback(
    (id: string | null) => setWorkspace((ws) => ({ ...ws, activeEnvironmentId: id })),
    [setWorkspace]
  );

  const handleCreateCollection = () => {
    const newCollection: Collection = {
      id: uuidv4(),
      type: 'collection',
      name: getUniqueNodeName(workspace.collections, 'New Collection'),
      children: [],
    };
    setWorkspace((ws) => ({ ...ws, collections: [...ws.collections, newCollection] }));
    setRenamingNodeId(newCollection.id);
    // On mobile the drawer would cover the screen; only reveal it on desktop.
    if (!isMobile) revealSidebarPanel('collections');
    else addToast(`Created "${newCollection.name}"`, 'success');
    return newCollection.id;
  };

  const handleImportCollection = (collection: Collection) => {
    setWorkspace((ws) => ({
      ...ws,
      collections: [...ws.collections, { ...collection, name: getUniqueNodeName(ws.collections, collection.name) }],
    }));
  };

  const addNode = useCallback((newNode: RequestNode, parentId?: string) => setWorkspace((ws) => addNodeUtil(ws, newNode, parentId)), [setWorkspace]);

  const deleteNode = useCallback((nodeId: string) => setWorkspace((ws) => deleteNodeUtil(ws, nodeId)), [setWorkspace]);

  const updateNode = useCallback(
    (nodeId: string, updater: (node: RequestNode | Collection) => RequestNode | Collection) => setWorkspace((ws) => updateNodeUtil(ws, nodeId, updater)),
    [setWorkspace]
  );

  const findNode = useCallback((nodeId: string) => findNodeUtil(workspace, nodeId), [workspace]);

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const result = duplicateNodeUtil(workspace, nodeId);
      if (result.newId) setWorkspace(result.workspace);
      return result.newId;
    },
    [workspace, setWorkspace]
  );

  const moveNode = useCallback(
    (dragId: string, targetId: string, position: DropPosition) => setWorkspace((ws) => moveNodeUtil(ws, dragId, targetId, position)),
    [setWorkspace]
  );

  const handleCreateFlow = (name: string) => {
    if (!name.trim()) {
      addToast('Flow name cannot be empty.', 'error');
      return;
    }
    const newFlow: Flow = { id: uuidv4(), name: name.trim(), nodes: [] };
    setWorkspace((ws) => ({ ...ws, flows: [...(ws.flows || []), newFlow] }));
    addToast(`Flow "${name}" created`, 'success');
  };

  const handleUpdateFlow = (flowId: string, updates: Partial<Flow>) => {
    setWorkspace((ws) => ({
      ...ws,
      flows: (ws.flows || []).map((f) => (f.id === flowId ? { ...f, ...updates } : f)),
    }));
  };

  const handleDeleteFlow = (flowId: string) => {
    setWorkspace((ws) => ({ ...ws, flows: (ws.flows || []).filter((f) => f.id !== flowId) }));
    addToast('Flow deleted', 'info');
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        setWorkspace,
        globals: workspace.globals ?? [],
        handleGlobalsChange,
        collections: workspace.collections,
        environments: workspace.environments ?? [],
        activeEnvironmentId: workspace.activeEnvironmentId,
        setActiveEnvironmentId,
        handleCreateCollection,
        handleImportCollection,
        addNode,
        deleteNode,
        updateNode,
        findNode,
        duplicateNode,
        moveNode,
        renamingNodeId,
        setRenamingNodeId,
        flows: workspace.flows || [],
        handleCreateFlow,
        handleUpdateFlow,
        handleDeleteFlow,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
};
