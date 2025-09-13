import React, { useMemo, useState } from 'react';
import { Collection, Folder, RequestItem, RequestNode, Workspace } from '../../types';
import { Button, IconButton } from '../ui/Button';
import { FolderPlus, Import, Plus, FilePlus, Search } from '../icons';
import { TreeView } from '../ui/TreeView';
import { Tooltip } from '../ui/Tooltip';
import { createDefaultRequest, getUniqueNodeName } from '../../utils/collection';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../../context/ToastContext';
import { EmptyState } from '../ui/EmptyState';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useApp } from '../../context/AppContext';
import { Input } from '../ui/Input';

interface CollectionsViewProps {
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  openRequestInTab: (requestItem: RequestItem, tabName: string) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

// FIX: Used generics to correctly type the recursive call.
const filterNodes = <T extends RequestNode | Collection>(nodes: T[], filter: string): T[] => {
    if (!filter) {
        return nodes;
    }

    const lowercasedFilter = filter.toLowerCase();

    return nodes.reduce((acc, node) => {
        const nameMatches = node.name.toLowerCase().includes(lowercasedFilter);
        
        if (node.type !== 'request') {
            const children = (node as Folder | Collection).children;
            const filteredChildren = filterNodes(children, filter);
            if (nameMatches || filteredChildren.length > 0) {
                acc.push({ ...node, children: filteredChildren });
            }
        } else {
            if (nameMatches) {
                acc.push(node);
            }
        }
        
        return acc;
    }, [] as T[]);
};

export const CollectionsView: React.FC<CollectionsViewProps> = ({ 
    openRequestInTab,
    selectedNodeId,
    setSelectedNodeId,
}) => {
    const { workspace, setWorkspace, addNode, deleteNode, updateNode, findNode } = useWorkspace();
    const { setIsImportModalOpen } = useApp();
    const { addToast } = useToast();
    const [filter, setFilter] = useState('');
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

    const filteredCollections = useMemo(() => {
        return filterNodes(workspace.collections, filter);
    }, [workspace.collections, filter]);

    const selectedNode = selectedNodeId ? findNode(selectedNodeId) : null;
    const canAddRequest = selectedNode && selectedNode.type !== 'request';
    
    const handleLocalCreateCollection = () => {
        const newName = getUniqueNodeName(workspace.collections, 'New Collection');
        const newCollection: Collection = {
            id: uuidv4(),
            type: 'collection',
            name: newName,
            children: [],
        };
        setWorkspace(ws => ({ ...ws, collections: [...ws.collections, newCollection] }));
        addToast("Collection created!", "success");
        setEditingNodeId(newCollection.id);
    };

    const handleCreateNode = (type: 'folder' | 'request', parentId?: string) => {
        const parentToUse = parentId || (canAddRequest ? selectedNodeId : null);
        if (!parentToUse) return;

        const parentNode = findNode(parentToUse);
        if (!parentNode || parentNode.type === 'request') return;

        const baseName = type === 'folder' ? 'New Folder' : 'New Request';
        const newName = getUniqueNodeName(parentNode.children, baseName);
        
        const newNode = type === 'folder'
            ? { id: uuidv4(), type: 'folder', name: newName, children: [] } as Folder
            : { id: uuidv4(), type: 'request', name: newName, request: createDefaultRequest(), responses: [] } as RequestItem;

        addNode(newNode, parentToUse);
        if (type === 'request' && !parentId) { // from header button
             addToast('Request added to selected folder/collection.', 'success');
        }
        setEditingNodeId(newNode.id);
    };
    
    const handleDeleteNode = (nodeId: string) => {
        deleteNode(nodeId);
        if (selectedNodeId === nodeId) {
            setSelectedNodeId(null);
        }
        addToast('Item deleted.', 'info');
    };
    
    const handleRenameNode = (nodeId: string, newName: string) => {
        updateNode(nodeId, node => ({...node, name: newName}));
        setEditingNodeId(null);
    };
    
    const handleNodeDoubleClick = (node: RequestNode) => {
        if (node.type === 'request') {
            openRequestInTab(node, node.name);
        }
    }

    const renderEmptyState = () => (
        <EmptyState 
            icon={<FolderPlus className="h-12 w-12 stroke-1 text-surface-muted" />}
            title="No Collections"
            message="Get started by creating a collection or importing one."
        >
            <div className="mt-6 flex gap-4">
                <Button onClick={handleLocalCreateCollection} variant="primary" className="w-auto">
                    <Plus className="h-4 w-4 mr-2" /> Create a Collection
                </Button>
                 <Button onClick={() => setIsImportModalOpen(true)} variant="secondary">
                    <Import className="h-4 w-4 mr-2" /> Import
                </Button>
            </div>
        </EmptyState>
    );

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
                <h2 className="text-sm font-semibold">Collections</h2>
                <div className="flex items-center">
                    <Tooltip content="Import">
                        <IconButton size="sm" variant="ghost" onClick={() => setIsImportModalOpen(true)}>
                            <Import className="h-4 w-4" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip content={canAddRequest ? 'Add request to selected folder' : 'Select a folder or collection first'}>
                        <IconButton size="sm" variant="ghost" onClick={() => handleCreateNode('request')} disabled={!canAddRequest}>
                            <FilePlus className="h-4 w-4" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip content="New Collection">
                        <IconButton size="sm" variant="ghost" onClick={handleLocalCreateCollection}>
                            <Plus className="h-4 w-4" />
                        </IconButton>
                    </Tooltip>
                </div>
            </div>
             <div className="p-4 border-b border-border flex-shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Filter collections..." 
                        value={filter} 
                        onChange={(e) => setFilter(e.target.value)}
                        className="text-sm w-full !pl-9"
                    />
                </div>
            </div>
            <div className="flex-grow overflow-y-auto p-2">
                {workspace.collections.length === 0 ? renderEmptyState() : (
                    filteredCollections.length === 0 && filter ? (
                        <EmptyState message="No items match your filter." />
                    ) : (
                        <TreeView 
                            nodes={filteredCollections}
                            selectedNodeId={selectedNodeId}
                            editingNodeId={editingNodeId}
                            onNodeSelect={(id) => {
                                setEditingNodeId(null);
                                setSelectedNodeId(id);
                            }}
                            onNodeDoubleClick={handleNodeDoubleClick}
                            onRenameNode={handleRenameNode}
                            onDeleteNode={handleDeleteNode}
                            onCreateNode={handleCreateNode}
                            onStartEdit={setEditingNodeId}
                            onEndEdit={() => setEditingNodeId(null)}
                        />
                    )
                )}
            </div>
        </div>
    );
};