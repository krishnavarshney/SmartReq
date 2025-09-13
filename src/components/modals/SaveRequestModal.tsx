import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TreeView } from '../ui/TreeView';
import { Collection, Workspace } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTabs } from '../../context/TabsContext';

interface SaveRequestModalProps {
  onClose: () => void;
  onSave: (name: string, parentId: string) => void;
}

export const SaveRequestModal: React.FC<SaveRequestModalProps> = ({ onClose, onSave }) => {
  const { workspace } = useWorkspace();
  const { activeTab } = useTabs();
  
  const [name, setName] = useState(activeTab?.name || 'New Request');
  const [parentId, setParentId] = useState<string | null>(null);

  const handleSave = () => {
    if (name && parentId) {
      onSave(name, parentId);
      onClose();
    }
  };
  
  const handleNodeSelect = (nodeId: string | null) => {
    // Prevent selecting requests as parents
    const search = (nodes: any[]): boolean => {
      for (const node of nodes) {
        if (node.id === nodeId && node.type === 'request') return true;
        if (node.children) {
          if (search(node.children)) return true;
        }
      }
      return false;
    }
    if (search(workspace.collections)) {
      return;
    }
    setParentId(nodeId);
  }

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <div className="flex justify-between items-center pb-3 border-b border-border">
        <h2 className="text-lg font-bold">Save Request</h2>
        <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">&times;</button>
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Request Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Request" />
        </div>
        <div>
          <label className="text-sm font-medium">Select a folder or collection</label>
          <div className="h-48 overflow-auto border border-border rounded-lg mt-1 p-2">
            <TreeView
              nodes={workspace.collections}
              selectedNodeId={parentId}
              editingNodeId={null}
              onNodeSelect={handleNodeSelect}
              onNodeDoubleClick={() => {}}
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
          <Button onClick={handleSave} disabled={!name || !parentId}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};