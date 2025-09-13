import React, { useState, useEffect, useRef } from 'react';
import { Collection, Folder, RequestItem, RequestNode } from '../../types';
import { ChevronRight, FileText, Folder as FolderIcon, FolderPlus, Plus, Copy, Trash2, PenSquare, FilePlus } from '../icons';
import { useToast } from '../../context/ToastContext';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from './ContextMenu';
import { IconButton } from './Button';
import { Tooltip } from './Tooltip';

interface TreeViewProps {
  nodes: (Collection | Folder | RequestItem)[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  onNodeDoubleClick: (node: RequestNode) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onCreateNode: (type: 'folder' | 'request', parentId: string) => void;
  onStartEdit: (nodeId: string) => void;
  onEndEdit: () => void;
}

const Node: React.FC<{
    node: RequestNode | Collection;
    level: number;
} & Omit<TreeViewProps, 'nodes'>> = ({ node, level, ...props }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [name, setName] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);
    const isContainer = node.type !== 'request';
    const prevChildrenCount = useRef(isContainer ? (node as Folder).children.length : 0);
    const { addToast } = useToast();

    const { selectedNodeId, editingNodeId, onNodeSelect, onNodeDoubleClick, onRenameNode, onDeleteNode, onCreateNode, onStartEdit, onEndEdit } = props;

    const isActive = selectedNodeId === node.id;
    const isEditing = editingNodeId === node.id;

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);
    
    useEffect(() => {
        setName(node.name);
    }, [node.name]);

    useEffect(() => {
        if (isContainer) {
            const currentChildrenCount = (node as Folder).children.length;
            if (currentChildrenCount > prevChildrenCount.current) {
                setIsExpanded(true);
            }
            prevChildrenCount.current = currentChildrenCount;
        }
    }, [isContainer, node]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);

    const handleRenameConfirm = () => {
        if (name.trim() && name !== node.name) {
            onRenameNode(node.id, name);
        } else {
            setName(node.name);
        }
        onEndEdit();
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleRenameConfirm();
        }
        if (e.key === 'Escape') {
            setName(node.name);
            onEndEdit();
        }
    }

    const handleNodeContainerClick = () => {
        onNodeSelect(node.id);
        if (isContainer) {
            setIsExpanded(!isExpanded);
        }
    }

    const handleDoubleClick = () => {
        onNodeSelect(node.id);
        if (isEditing) return; // Don't trigger double click action when starting an edit
        if (node.type !== 'collection') {
            onNodeDoubleClick(node);
        }
    }

    const handleCopyUrl = () => {
        if (node.type === 'request') {
            const url = (node as RequestItem).request.url;
            navigator.clipboard.writeText(url);
            addToast('URL copied to clipboard', 'success');
        }
    }

    return (
        <div className="relative">
            <ContextMenu>
                <ContextMenuTrigger>
                    <div
                        className={`flex items-center p-2 rounded-md cursor-pointer group transition-colors duration-150 relative ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                        style={{ paddingLeft: `${level * 24 + 16}px` }}
                        onClick={handleNodeContainerClick}
                        onDoubleClick={handleDoubleClick}
                    >
                        <div className="flex items-center gap-2 flex-grow overflow-hidden">
                            {isContainer && (
                            <ChevronRight
                                className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                            )}
                            <div className={`w-4 h-4 flex-shrink-0 ${!isContainer ? 'ml-5' : ''}`}>
                            {node.type === 'folder' || node.type === 'collection' ? <FolderIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            {isEditing ? (
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={name}
                                    onChange={handleNameChange}
                                    onBlur={handleRenameConfirm}
                                    onKeyDown={handleKeyDown}
                                    className="bg-transparent border-b border-primary text-sm focus:outline-none w-full"
                                    onClick={e => e.stopPropagation()}
                                />
                            ) : (
                            <span className="text-sm truncate">{node.name}</span>
                            )}
                        </div>
                        <div className="flex-shrink-0 ml-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {isContainer && (
                                <>
                                <Tooltip content="New Request">
                                    <IconButton size="sm" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onCreateNode('request', node.id); }}>
                                        <FilePlus className="h-4 w-4" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip content="New Folder">
                                    <IconButton size="sm" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onCreateNode('folder', node.id); }}>
                                        <FolderPlus className="h-4 w-4" />
                                    </IconButton>
                                </Tooltip>
                                </>
                            )}
                             <Tooltip content="Rename">
                                <IconButton size="sm" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onStartEdit(node.id); }}>
                                    <PenSquare className="h-4 w-4" />
                                </IconButton>
                            </Tooltip>
                             <Tooltip content="Delete">
                                <IconButton size="sm" variant="ghost" className="h-6 w-6 hover:!text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}>
                                    <Trash2 className="h-4 w-4" />
                                </IconButton>
                            </Tooltip>
                        </div>
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onClick={() => onStartEdit(node.id)}><PenSquare className="h-4 w-4 mr-2" />Rename</ContextMenuItem>
                    {node.type === 'request' && <ContextMenuItem onClick={handleCopyUrl}><Copy className="h-4 w-4 mr-2" /> Copy URL</ContextMenuItem>}
                    {isContainer && <>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => onCreateNode('request', node.id)}>
                            <FilePlus className="h-4 w-4 mr-2" /> New Request
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onCreateNode('folder', node.id)}>
                            <FolderPlus className="h-4 w-4 mr-2" /> New Folder
                        </ContextMenuItem>
                    </>}
                     <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onDeleteNode(node.id)} className="!text-destructive hover:!bg-destructive/10">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            {isContainer && isExpanded && (node as Folder).children && (
                <div className="mt-1 space-y-1">
                    {(node as Folder).children.map(child => (
                        <Node 
                            key={child.id} 
                            node={child} 
                            level={level + 1} 
                            {...props}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const TreeView: React.FC<TreeViewProps> = (props) => {
    return (
        <div className="space-y-1">
            {props.nodes.map(node => <Node key={node.id} node={node} level={0} {...props} />)}
        </div>
    );
};