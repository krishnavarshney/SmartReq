import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { FlowBuilder } from './FlowBuilder';
import { Resizable } from 're-resizable';
import { VerticalResizableHandle } from '../ui/VerticalResizableHandle';
import { SelectRequestModal } from '../modals/SelectRequestModal';
import { v4 as uuidv4 } from 'uuid';
import { FlowNode } from '../../types';
import { FlowNodePanel } from './FlowNodePanel';
import { SequenceDiagram } from './SequenceDiagram';

export const FlowWorkspace: React.FC = () => {
    const { flows, handleCreateFlow, handleUpdateFlow, findNode } = useWorkspace();
    const [newFlowName, setNewFlowName] = useState('');
    const [activeFlowId, setActiveFlowId] = useState<string | null>(flows[0]?.id || null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const activeFlow = flows.find(f => f.id === activeFlowId);
    const selectedNode = activeFlow?.nodes.find(n => n.id === selectedNodeId);

    const handleAddRequestToFlow = (requestItem: { id: string, name: string }) => {
        if (!activeFlow) return;
        
        const newNode: FlowNode = {
            id: uuidv4(),
            requestId: requestItem.id,
            name: requestItem.name,
            extractions: [],
        };

        handleUpdateFlow(activeFlow.id, { nodes: [...activeFlow.nodes, newNode] });
    };

    const handleNodeChange = (nodeId: string, updates: Partial<FlowNode>) => {
        if (!activeFlow) return;
        const newNodes = activeFlow.nodes.map(n => n.id === nodeId ? {...n, ...updates} : n);
        handleUpdateFlow(activeFlow.id, { nodes: newNodes });
    };

    if (flows.length === 0) {
        return (
            <EmptyState
                title="No Flows Created"
                message="Create your first flow to chain multiple API requests together."
            >
                <div className="mt-4 flex items-center gap-2">
                    <Input 
                        placeholder="My New Flow"
                        value={newFlowName}
                        onChange={(e) => setNewFlowName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFlow(newFlowName)}
                    />
                    <Button onClick={() => handleCreateFlow(newFlowName)} className="w-auto">Create Flow</Button>
                </div>
            </EmptyState>
        );
    }
    
    // For now, we will just show the builder. SequenceDiagram will be integrated later.
    if (!activeFlow) {
        // Simple flow selector
        return (
            <div className="p-4">
                <h2 className="text-xl font-bold mb-4">Select a Flow</h2>
                <div className="space-y-2">
                {flows.map(flow => (
                    <button key={flow.id} onClick={() => setActiveFlowId(flow.id)} className="block w-full text-left p-2 bg-card hover:bg-muted rounded">
                        {flow.name}
                    </button>
                ))}
                </div>
            </div>
        )
    }

    return (
        <div className="flex-grow flex gap-4 h-full overflow-hidden">
            <Resizable
                defaultSize={{ width: '30%', height: '100%' }}
                minWidth={300}
                maxWidth="50%"
                enable={{ right: true }}
                handleComponent={{ right: <VerticalResizableHandle /> }}
            >
                <FlowBuilder
                    flow={activeFlow}
                    onFlowChange={(updates) => handleUpdateFlow(activeFlowId!, updates)}
                    onAddStepClick={() => setIsModalOpen(true)}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={setSelectedNodeId}
                    findNode={findNode}
                />
            </Resizable>
            <div className="flex-grow overflow-auto">
                {selectedNode ? (
                    <FlowNodePanel
                        key={selectedNode.id}
                        flowId={activeFlowId!}
                        node={selectedNode}
                        onNodeChange={handleNodeChange}
                    />
                ) : (
                    <EmptyState message="Select a step to configure it, or add a new one." />
                )}
            </div>
            {isModalOpen && (
                <SelectRequestModal
                    onClose={() => setIsModalOpen(false)}
                    onSelect={handleAddRequestToFlow}
                />
            )}
        </div>
    );
};