import React, { useId, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Collection, RequestNode } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTabs } from '../../context/TabsContext';
import { Folder, FolderKanban, FolderPlus, Save, Search } from '../icons';

interface SaveRequestModalProps {
  onClose: () => void;
  onSave: (name: string, parentId: string) => void;
}

interface Destination {
  id: string;
  name: string;
  depth: number;
  path: string;
  isCollection: boolean;
}

const flatten = (collections: Collection[]): Destination[] => {
  const out: Destination[] = [];
  const walk = (nodes: RequestNode[], depth: number, path: string) => {
    nodes.forEach((n) => {
      if (n.type !== 'folder') return;
      const p = `${path} / ${n.name}`;
      out.push({ id: n.id, name: n.name, depth, path: p, isCollection: false });
      walk(n.children, depth + 1, p);
    });
  };
  collections.forEach((c) => {
    out.push({ id: c.id, name: c.name, depth: 0, path: c.name, isCollection: true });
    walk(c.children, 1, c.name);
  });
  return out;
};

export const SaveRequestModal: React.FC<SaveRequestModalProps> = ({ onClose, onSave }) => {
  const id = useId();
  const { workspace, setWorkspace } = useWorkspace();
  const { activeTab } = useTabs();
  const destinations = useMemo(() => flatten(workspace.collections), [workspace.collections]);

  const [name, setName] = useState(activeTab?.name || 'New Request');
  const [parentId, setParentId] = useState<string | null>(destinations[0]?.id ?? null);
  const [filter, setFilter] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('My Collection');

  const visible = filter.trim() ? destinations.filter((d) => d.path.toLowerCase().includes(filter.trim().toLowerCase())) : destinations;
  const selected = destinations.find((d) => d.id === parentId);
  const canSave = !!name.trim() && !!selected;

  const handleSave = () => {
    if (!canSave || !parentId) return;
    onSave(name.trim(), parentId);
  };

  const createCollection = () => {
    const collection: Collection = { id: uuidv4(), type: 'collection', name: newCollectionName.trim() || 'My Collection', children: [] };
    setWorkspace((ws) => ({ ...ws, collections: [...ws.collections, collection] }));
    setParentId(collection.id);
  };

  return (
    <Modal
      show
      onClose={onClose}
      size="lg"
      icon={<Save />}
      title="Save request"
      description="Choose a name and where to keep it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save{selected ? ` to ${selected.name}` : ''}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor={`${id}-name`} className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Get user" autoFocus onFocus={(e) => e.currentTarget.select()} />
        </div>

        <div className="space-y-1.5">
          <span id={`${id}-dest`} className="text-xs font-medium text-muted-foreground">
            Save to
          </span>
          {destinations.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4">
              <p className="mb-3 text-[13px] text-muted-foreground">You don't have any collections yet. Create one to save this request into.</p>
              <div className="flex gap-2">
                <Input value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} aria-label="Collection name" />
                <Button variant="secondary" onClick={createCollection} type="button">
                  <FolderPlus className="h-3.5 w-3.5" /> Create
                </Button>
              </div>
            </div>
          ) : (
            <>
              {destinations.length > 6 && (
                <Input size="sm" icon={<Search />} placeholder="Filter folders" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter folders" />
              )}
              <div
                role="listbox"
                aria-labelledby={`${id}-dest`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                  e.preventDefault();
                  const idx = visible.findIndex((d) => d.id === parentId);
                  const next = visible[Math.max(0, Math.min(visible.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)))];
                  if (next) setParentId(next.id);
                }}
                className="max-h-56 overflow-auto rounded-md border border-border p-1 focus-ring"
              >
                {visible.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No folders match.</p>}
                {visible.map((d) => (
                  <div
                    key={d.id}
                    role="option"
                    aria-selected={d.id === parentId}
                    onClick={() => setParentId(d.id)}
                    onDoubleClick={() => {
                      setParentId(d.id);
                      if (name.trim()) onSave(name.trim(), d.id);
                    }}
                    style={{ paddingLeft: 8 + (filter ? 0 : d.depth * 16) }}
                    className={`flex h-8 cursor-pointer items-center gap-2 rounded-md pr-2 text-[13px] ${
                      d.id === parentId ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {d.isCollection ? <FolderKanban className="h-3.5 w-3.5 flex-shrink-0" /> : <Folder className="h-3.5 w-3.5 flex-shrink-0" />}
                    <span className="truncate">{filter ? d.path : d.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
};
