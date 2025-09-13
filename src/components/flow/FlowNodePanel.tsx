import React, { useState } from 'react';
import { FlowNode, VariableExtraction } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { RequestComposer } from '../request/RequestComposer';
import { KeyValueEditor } from '../ui/KeyValueEditor';
import { v4 as uuidv4 } from 'uuid';

interface FlowNodePanelProps {
    flowId: string;
    node: FlowNode;
    onNodeChange: (nodeId: string, updates: Partial<FlowNode>) => void;
}

export const FlowNodePanel: React.FC<FlowNodePanelProps> = ({ flowId, node, onNodeChange }) => {
    const { findNode } = useWorkspace();
    const requestItem = findNode(node.requestId);

    if (!requestItem || requestItem.type !== 'request') {
        return <div className="p-4 text-muted-foreground">Original request not found.</div>;
    }

    const handleExtractionsChange = (extractions: VariableExtraction[]) => {
        onNodeChange(node.id, { extractions });
    };

    const handleItemChange = (index: number, field: keyof Omit<VariableExtraction, 'id' | 'source'>, value: string) => {
        const newItems = [...node.extractions];
        (newItems[index] as any)[field] = value;
        onNodeChange(node.id, { extractions: newItems });
    };

    const addExtraction = () => {
        const newExtraction: VariableExtraction = { id: uuidv4(), name: '', source: 'BODY_JSON', path: '' };
        onNodeChange(node.id, { extractions: [...node.extractions, newExtraction] });
    };

    const deleteExtraction = (id: string) => {
        onNodeChange(node.id, { extractions: node.extractions.filter(e => e.id !== id) });
    };


    return (
        <div className="h-full flex flex-col bg-card rounded-lg border border-border">
            <div className="p-3 border-b border-border">
                <h3 className="font-semibold text-foreground">Step: {node.name}</h3>
            </div>
            <div className="flex-grow overflow-auto">
                <div className="p-4 border-b border-border">
                    <h4 className="font-semibold text-sm mb-2">Variable Extractions</h4>
                    <p className="text-xs text-muted-foreground mb-3">Extract values from this step's response to use in later steps with <code>{`{{variableName}}`}</code> syntax.</p>
                    <KeyValueEditor
                        items={node.extractions.map(e => ({ id: 0, key: e.name, value: e.path, enabled: true }))}
                        onItemsChange={(items) => {
                            const newExtractions = items.map((item, i) => ({
                                ...node.extractions[i],
                                id: node.extractions[i]?.id || uuidv4(),
                                name: item.key,
                                path: item.value,
                                source: 'BODY_JSON' as const, // Currently only supporting JSON body
                            })).filter(e => e.name || e.path);
                            onNodeChange(node.id, { extractions: newExtractions });
                        }}
                        keyPlaceholder="Variable Name (e.g., authToken)"
                        valuePlaceholder="JSON Path (e.g., data.token)"
                        layout="stacked"
                    />
                </div>
                <div className="p-4">
                     <h4 className="font-semibold text-sm mb-2">Original Request</h4>
                     <div className="h-96 border border-border rounded-lg overflow-hidden">
                        <RequestComposer
                            request={requestItem.request}
                            onRequestChange={() => {}}
                            onBodyValidationChange={() => {}}
                            onGenerateBulkData={() => {}}
                            onSave={() => {}}
                            globals={[]}
                        />
                     </div>
                </div>
            </div>
        </div>
    );
};