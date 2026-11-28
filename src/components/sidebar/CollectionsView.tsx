import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Collection, Folder, RequestItem, RequestNode, Workspace } from '../../types';
import { Button, IconButton } from '../ui/Button';
import { FolderKanban, Import, Plus, Search, X } from '../icons';
import { TreeView } from '../ui/TreeView';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmDialog } from '../ui/Modal';
import { canMoveNode, countRequests, createDefaultRequest, getUniqueNodeName } from '../../utils/collection';
import { useToast } from '../../context/ToastContext';
import { EmptyState } from '../ui/EmptyState';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useApp } from '../../context/AppContext';
import { useTabs } from '../../context/TabsContext';
import { Input } from '../ui/Input';
import { usePersistentState } from '../../hooks/usePersistentState';

interface CollectionsViewProps {
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  openRequestInTab: (requestItem: RequestItem, tabName: string) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

const matches = (node: RequestNode | Collection, q: string) =>
  node.name.toLowerCase().includes(q) || (node.type === 'request' && node.request.url.toLowerCase().includes(q));

/** Keep nodes that match (or contain a match). A matching container keeps all its children. */
const filterNodes = <T extends RequestNode | Collection>(nodes: T[], q: string): T[] =>
  nodes.reduce<T[]>((acc, node) => {
    if (node.type === 'request') {
      if (matches(node, q)) acc.push(node);
    } else if (node.name.toLowerCase().includes(q)) {
      acc.push(node);
    } else {
      const children = filterNodes(node.children, q);
      if (children.length) acc.push({ ...node, children });
    }
    return acc;
  }, []);

const PanelHeader: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="flex h-10 flex-shrink-0 items-center justify-between gap-2 border-b border-border pl-3 pr-1.5">
    <h2 className="truncate text-[13px] font-semibold text-foreground">{title}</h2>
    <div className="flex items-center gap-0.5">{children}</div>
  </div>
);

export const CollectionsView: React.FC<CollectionsViewProps> = ({ openRequestInTab, selectedNodeId, setSelectedNodeId }) => {
  const { workspace, setWorkspace, addNode, deleteNode, updateNode, findNode, duplicateNode, moveNode, renamingNodeId, setRenamingNodeId } =
    useWorkspace();
  const { setIsImportModalOpen, isMobile } = useApp();
  const { activeTab, setTabs } = useTabs();
  const { addToast } = useToast();
  const [filter, setFilter] = useState('');
  const [collapsedIds, setCollapsedIds] = usePersistentState<string[]>('collectionsCollapsed_v1', []);
  const [pendingDelete, setPendingDelete] = useState<RequestNode | Collection | null>(null);

  const query = filter.trim().toLowerCase();
  const filteredCollections = useMemo(() => (query ? filterNodes(workspace.collections, query) : workspace.collections), [workspace.collections, query]);

  const handleCreateCollection = () => {
    const newCollection: Collection = {
      id: uuidv4(),
      type: 'collection',
      name: getUniqueNodeName(workspace.collections, 'New Collection'),
      children: [],
    };
    setWorkspace((ws) => ({ ...ws, collections: [...ws.collections, newCollection] }));
    setFilter('');
    setSelectedNodeId(newCollection.id);
    setRenamingNodeId(newCollection.id);
  };

  const handleCreateNode = (type: 'folder' | 'request', parentId: string) => {
    const parentNode = findNode(parentId);
    if (!parentNode || parentNode.type === 'request') return;
    const name = getUniqueNodeName(parentNode.children, type === 'folder' ? 'New Folder' : 'New Request');
    const newNode: RequestNode =
      type === 'folder'
        ? ({ id: uuidv4(), type: 'folder', name, children: [] } as Folder)
        : ({ id: uuidv4(), type: 'request', name, request: createDefaultRequest(), responses: [] } as RequestItem);
    addNode(newNode, parentId);
    setFilter('');
    setCollapsedIds((ids) => ids.filter((id) => id !== parentId));
    setSelectedNodeId(newNode.id);
    if (newNode.type === 'request') {
      openRequestInTab(newNode, newNode.name);
      // On mobile opening a request closes the drawer, so there is nothing to rename in place.
      if (isMobile) return;
    }
    setRenamingNodeId(newNode.id);
  };

  const confirmDelete = () => {
    const node = pendingDelete;
    setPendingDelete(null);
    if (!node) return;
    deleteNode(node.id);
    // Tabs that pointed at deleted requests become unsaved drafts.
    const removed = new Set<string>();
    const collect = (n: RequestNode | Collection) => {
      removed.add(n.id);
      if (n.type !== 'request') n.children.forEach(collect);
    };
    collect(node);
    setTabs((tabs) => tabs.map((t) => (t.originalRequestId && removed.has(t.originalRequestId) ? { ...t, originalRequestId: undefined, isDirty: true } : t)));
    if (selectedNodeId && removed.has(selectedNodeId)) setSelectedNodeId(null);
    addToast(`Deleted "${node.name}"`, 'info');
  };

  const handleRenameNode = (nodeId: string, newName: string) => {
    updateNode(nodeId, (node) => ({ ...node, name: newName }));
    // Keep the open tab's title in sync with the saved request name.
    setTabs((tabs) => tabs.map((t) => (t.originalRequestId === nodeId ? { ...t, name: newName } : t)));
  };

  const handleDuplicate = (nodeId: string) => {
    const newId = duplicateNode(nodeId);
    if (newId) {
      setSelectedNodeId(newId);
      setRenamingNodeId(newId);
    }
  };

  const deleteDescription = (() => {
    if (!pendingDelete) return null;
    if (pendingDelete.type === 'request') return <>The request will be removed from its collection. Open tabs keep a copy as an unsaved draft.</>;
    const n = countRequests(pendingDelete);
    return (
      <>
        This removes the {pendingDelete.type} and {n === 0 ? 'everything in it' : `${n} request${n === 1 ? '' : 's'} inside it`}. This can’t be undone.
      </>
    );
  })();

  const isEmpty = workspace.collections.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader title="Collections">
        <Tooltip content="Import" side="bottom">
          <IconButton size="sm" aria-label="Import" onClick={() => setIsImportModalOpen(true)}>
            <Import className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip content="New collection" side="bottom">
          <IconButton size="sm" aria-label="New collection" onClick={handleCreateCollection}>
            <Plus className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </PanelHeader>

      {!isEmpty && (
        <div className="flex-shrink-0 px-2 pb-1 pt-2">
          <div className="relative">
            <Input
              size="sm"
              icon={<Search />}
              placeholder="Filter requests"
              aria-label="Filter requests"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && filter && (e.stopPropagation(), setFilter(''))}
              className="pr-7"
            />
            {filter && (
              <button
                type="button"
                aria-label="Clear filter"
                onClick={() => setFilter('')}
                className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 pb-2">
        {isEmpty ? (
          <EmptyState compact icon={<FolderKanban />} title="No collections yet" message="Group related requests into collections, or import an OpenAPI spec, Postman collection or cURL command.">
            <div className="flex w-full max-w-[220px] flex-col gap-2">
              <Button size="sm" onClick={handleCreateCollection} className="w-full">
                <Plus className="h-3.5 w-3.5" /> New collection
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setIsImportModalOpen(true)} className="w-full">
                <Import className="h-3.5 w-3.5" /> Import
              </Button>
            </div>
          </EmptyState>
        ) : filteredCollections.length === 0 ? (
          <EmptyState compact icon={<Search />} message={<>No requests match “{filter.trim()}”.</>}>
            <Button size="sm" variant="ghost" onClick={() => setFilter('')}>
              Clear filter
            </Button>
          </EmptyState>
        ) : (
          <TreeView
            editable
            nodes={filteredCollections}
            highlight={query ? filter.trim() : undefined}
            selectedNodeId={selectedNodeId}
            activeNodeId={activeTab?.originalRequestId ?? null}
            editingNodeId={renamingNodeId}
            collapsedIds={collapsedIds}
            onCollapsedIdsChange={setCollapsedIds}
            onNodeSelect={(id) => {
              setSelectedNodeId(id);
              const node = id ? findNode(id) : undefined;
              if (node?.type === 'request') openRequestInTab(node, node.name);
            }}
            onNodeDoubleClick={(node) => node.type === 'request' && openRequestInTab(node, node.name)}
            onRenameNode={handleRenameNode}
            onDeleteNode={(id) => {
              const node = findNode(id);
              if (node) setPendingDelete(node);
            }}
            onCreateNode={handleCreateNode}
            onDuplicateNode={handleDuplicate}
            onMoveNode={moveNode}
            canMoveNode={(dragId, targetId, position) => canMoveNode(workspace, dragId, targetId, position)}
            onStartEdit={setRenamingNodeId}
            onEndEdit={() => setRenamingNodeId(null)}
          />
        )}
      </div>

      <ConfirmDialog
        show={!!pendingDelete}
        title={pendingDelete ? `Delete “${pendingDelete.name}”?` : ''}
        description={deleteDescription}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
