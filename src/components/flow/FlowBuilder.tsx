import React from 'react';
import { Flow, FlowNode, RequestItem, RequestNode, Collection } from '../../types';
import { Button, IconButton } from '../ui/Button';
import { Plus, Trash2, ArrowUp, ArrowDown } from '../icons';
import { EmptyState } from '../ui/EmptyState';

interface FlowBuilderProps {
  flow: Flow;
  onFlowChange: (updates: Partial<Flow>) => void;
  onAddStepClick: () => void;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  findNode: (nodeId: string) => RequestNode | Collection | undefined;
}

const getMethodClass = (method?: string) => {
    switch(method) {
        case 'GET': return 'text-sky-400';
        case 'POST': return 'text-emerald-400';
        case 'PUT': return 'text-amber-400';
        case 'PATCH': return 'text-orange-400';
        case 'DELETE': return 'text-rose-400';
        default: return 'text-muted-foreground';
    }
}


export const FlowBuilder: React.FC<FlowBuilderProps> = ({ flow, onFlowChange, onAddStepClick, selectedNodeId, onNodeSelect, findNode }) => {
    
    const handleMoveNode = (index: number, direction: 'up' | 'down') => {
        const newNodes = [...flow.nodes];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex >= 0 && targetIndex < newNodes.length) {
            [newNodes[index], newNodes[targetIndex]] = [newNodes[targetIndex], newNodes[index]];
            onFlowChange({ nodes: newNodes });
        }
    };

    const handleDeleteNode = (nodeId: string) => {
        onFlowChange({ nodes: flow.nodes.filter(n => n.id !== nodeId) });
        if (selectedNodeId === nodeId) {
            onNodeSelect(null);
        }
    };
    
    return (
        <div className="h-full flex flex-col bg-card rounded-lg border border-border">
            <div className="p-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{flow.name}</h3>
                <Button size="sm" variant="secondary" onClick={onAddStepClick}>
                    <Plus className="h-4 w-4 mr-2" /> Add Step
                </Button>
            </div>
            <div className="flex-grow overflow-y-auto p-2">
                {flow.nodes.length === 0 ? (
                    <EmptyState message="This flow has no steps. Click 'Add Step' to begin." />
                ) : (
                    <div className="space-y-2">
                        {flow.nodes.map((node, index) => {
                            const requestItem = findNode(node.requestId);
                            const method = requestItem?.type === 'request' ? (requestItem as RequestItem).request.method : undefined;
                            
                            let urlPath = '...';
                            if (requestItem?.type === 'request' && (requestItem as RequestItem).request.url) {
                                try {
                                    urlPath = new URL((requestItem as RequestItem).request.url).pathname;
                                } catch (e) {
                                    urlPath = (requestItem as RequestItem).request.url;
                                }
                            }

                            return (
                                <div 
                                    key={node.id}
                                    onClick={() => onNodeSelect(node.id)}
                                    className={`group flex items-center p-2 rounded-md cursor-pointer transition-colors ${selectedNodeId === node.id ? 'bg-primary/10' : 'hover:bg-muted'}`}
                                >
                                    <span className="text-lg font-bold text-muted-foreground mr-3">{index + 1}</span>
                                    <div className="flex-grow overflow-hidden">
                                        <p className="font-semibold truncate text-foreground text-sm">{node.name}</p>
                                        <p className="font-mono text-xs">
                                            <span className={`font-bold ${getMethodClass(method)}`}>{method}</span>
                                            <span className="ml-2 text-muted-foreground truncate">{urlPath}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <IconButton size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleMoveNode(index, 'up')}} disabled={index === 0}>
                                            <ArrowUp className="h-4 w-4" />
                                        </IconButton>
                                        <IconButton size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleMoveNode(index, 'down')}} disabled={index === flow.nodes.length - 1}>
                                            <ArrowDown className="h-4 w-4" />
                                        </IconButton>
                                         <IconButton size="sm" variant="ghost" className="hover:!text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id)}}>
                                            <Trash2 className="h-4 w-4" />
                                        </IconButton>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};