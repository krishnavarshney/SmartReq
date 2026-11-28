import React, { useMemo, useState } from 'react';
import { Check, FolderInput, Search } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { RequestItem, RequestNode } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getMethodClass, getMethodShort } from '../../utils/http-ui';

interface SelectRequestModalProps {
  onClose: () => void;
  /** Called once per chosen request, in the order they were picked. */
  onSelect: (requestItem: { id: string; name: string }) => void;
  /** Optional: receive all chosen requests in one call (preferred for batch updates). */
  onSelectMany?: (requestItems: { id: string; name: string }[]) => void;
  title?: string;
}

interface Row {
  item: RequestItem;
  path: string;
}

const collect = (nodes: RequestNode[], path: string[]): Row[] =>
  nodes.flatMap((n) => (n.type === 'request' ? [{ item: n, path: path.join(' / ') }] : collect(n.children, [...path, n.name])));

/** Pick one or more saved requests from the workspace's collections. */
export const SelectRequestModal: React.FC<SelectRequestModalProps> = ({ onClose, onSelect, onSelectMany, title = 'Add saved requests' }) => {
  const { workspace } = useWorkspace();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const rows = useMemo(() => workspace.collections.flatMap((c) => collect(c.children, [c.name])), [workspace.collections]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ item, path }) => `${item.name} ${item.request.method} ${item.request.url} ${path}`.toLowerCase().includes(q));
  }, [rows, query]);
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    filtered.forEach((r) => map.set(r.path, [...(map.get(r.path) ?? []), r]));
    return [...map.entries()];
  }, [filtered]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const confirm = (ids: string[]) => {
    const chosen = ids.map((id) => rows.find((r) => r.item.id === id)).filter((r): r is Row => !!r).map((r) => ({ id: r.item.id, name: r.item.name }));
    if (chosen.length === 0) return;
    if (onSelectMany) onSelectMany(chosen);
    else chosen.forEach(onSelect);
    onClose();
  };

  return (
    <Modal
      show
      onClose={onClose}
      size="lg"
      flush
      icon={<FolderInput />}
      title={title}
      description="Each request becomes a step, in the order you pick them. Steps stay linked to the saved request."
      footer={
        rows.length > 0 ? (
          <>
            <span className="mr-auto text-xs text-muted-foreground">{picked.length ? `${picked.length} selected` : 'Click to select, double-click to add one'}</span>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => confirm(picked)} disabled={picked.length === 0}>
              {picked.length > 1 ? `Add ${picked.length} steps` : 'Add step'}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon={<FolderInput />}
          title="No saved requests yet"
          message="Save a request to a collection from the Request tab first, or add a blank request step that lives only in the flow."
          className="py-10"
        />
      ) : (
        <div className="flex max-h-[60vh] min-h-[16rem] flex-col">
          <div className="border-b border-border p-3">
            <Input
              autoFocus
              icon={<Search />}
              placeholder="Search by name, method or URL"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length === 1) confirm([filtered[0].item.id]);
              }}
              aria-label="Search saved requests"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2" role="listbox" aria-multiselectable="true" aria-label="Saved requests">
            {groups.length === 0 && <EmptyState compact message={`No requests match "${query}".`} />}
            {groups.map(([path, items]) => (
              <div key={path} className="mb-2 last:mb-0">
                <div className="truncate px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{path}</div>
                {items.map(({ item }) => {
                  const order = picked.indexOf(item.id);
                  const isPicked = order >= 0;
                  return (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected={isPicked}
                      tabIndex={0}
                      onClick={() => toggle(item.id)}
                      onDoubleClick={() => confirm([item.id])}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          if (e.key === 'Enter' && picked.length === 0) confirm([item.id]);
                          else toggle(item.id);
                        }
                      }}
                      className={`flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 focus-ring ${isPicked ? 'bg-primary/10' : 'hover:bg-accent'}`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] font-semibold tabular-nums ${
                          isPicked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'
                        }`}
                      >
                        {isPicked && (picked.length > 1 ? order + 1 : <Check className="h-3 w-3" strokeWidth={3} />)}
                      </span>
                      <span className={`w-9 flex-shrink-0 font-mono text-[11px] font-semibold ${getMethodClass(item.request.method)}`}>
                        {getMethodShort(item.request.method)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-foreground">{item.name}</span>
                      </span>
                      <span className="hidden max-w-[45%] truncate font-mono text-xs text-muted-foreground sm:block">{item.request.url}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};
