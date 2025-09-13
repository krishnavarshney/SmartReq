import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TreeView } from '../ui/TreeView';
import { RequestItem, RequestNode } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';

interface SelectRequestModalProps {
    onClose: () => void;
    onSelect: (requestItem: { id: string, name: string }) => void;
}

export const SelectRequestModal: React.FC<SelectRequestModalProps> = ({ onClose, onSelect }) => {
    const { workspace } = useWorkspace();
    const [selectedNode, setSelectedNode] = useState<RequestNode | null>(null);

    const handleSelect = () => {
        if (selectedNode && selectedNode.type === 'request') {
            onSelect({ id: selectedNode.id, name: selectedNode.name });
            onClose();
        }
    };
    
    return (
        <Modal show={true} onClose={onClose} size="lg">
            <div className="flex justify-between items-center pb-3 border-b border-border">
                <h2 className="text-lg font-bold">Select a Request</h2>
                <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">&times;</button>
            </div>
            <div className="mt-4 space-y-4">
                <div>
                    <div className="h-64 overflow-auto border border-border rounded-lg p-2">
                        <TreeView
                            nodes={workspace.collections}
                            selectedNodeId={selectedNode?.id || null}
                            editingNodeId={null}
                            onNodeSelect={(id) => {
                                const node = workspace.collections.flatMap(c => c.children).find(n => n.id === id);
                                if (node && node.type === 'request') {
                                    setSelectedNode(node);
                                }
                            }}
                            onNodeDoubleClick={(node) => {
                                if (node.type === 'request') {
                                    onSelect({ id: node.id, name: node.name });
                                    onClose();
                                }
                            }}
                            onRenameNode={() => {}}
                            onDeleteNode={() => {}}
                            onCreateNode={() => {}}
                            onStartEdit={() => {}}
                            onEndEdit={() => {}}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSelect} disabled={!selectedNode || selectedNode.type !== 'request'}>
                        Select Request
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
