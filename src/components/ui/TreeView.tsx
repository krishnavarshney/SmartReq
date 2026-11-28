import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Collection, Folder, RequestItem, RequestNode } from '../../types';
import { ChevronRight, Copy, Trash2, FilePlus, FolderPlus, ExternalLink, FolderKanban } from '../icons';
import { FolderClosed, FolderOpen, MoreHorizontal, Pencil, CopyPlus, Plus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from './ContextMenu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './DropdownMenu';
import { Tooltip } from './Tooltip';
import { getMethodClass, getMethodShort } from '../../utils/http-ui';
import { countRequests, findAncestorIds, DropPosition } from '../../utils/collection';

type TreeNode = Collection | Folder | RequestItem;

interface TreeViewProps {
  nodes: TreeNode[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  /** Double click or Enter on a request. */
  onNodeDoubleClick: (node: RequestNode) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onCreateNode: (type: 'folder' | 'request', parentId: string) => void;
  onStartEdit: (nodeId: string) => void;
  onEndEdit: () => void;
  /** Enables row actions (hover menu, context menu, F2 / Delete keys). Off for pickers. */
  editable?: boolean;
  /** Request currently open in the active tab. */
  activeNodeId?: string | null;
  /** Text to highlight in names. While set, every container is shown expanded. */
  highlight?: string;
  onDuplicateNode?: (nodeId: string) => void;
  /** Providing this enables drag and drop (disabled while `highlight` is set). */
  onMoveNode?: (dragId: string, targetId: string, position: DropPosition) => void;
  canMoveNode?: (dragId: string, targetId: string, position: DropPosition) => boolean;
  /** Controlled collapsed state; uncontrolled (all expanded) when omitted. */
  collapsedIds?: string[];
  onCollapsedIdsChange?: (ids: string[]) => void;
  'aria-label'?: string;
  /** Hide the request-count meta on containers. */
  hideCounts?: boolean;
}

interface Row {
  node: TreeNode;
  level: number;
  parentId: string | null;
  posinset: number;
  setsize: number;
  isContainer: boolean;
  expanded: boolean;
}

const Highlight: React.FC<{ text: string; query?: string }> = ({ text, query }) => {
  const q = query?.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let at = lower.indexOf(needle);
  while (at !== -1) {
    if (at > i) parts.push(text.slice(i, at));
    parts.push(<mark key={at}>{text.slice(at, at + needle.length)}</mark>);
    i = at + needle.length;
    at = lower.indexOf(needle, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return <>{parts}</>;
};

const RenameInput: React.FC<{ initial: string; onCommit: (name: string) => void; onCancel: () => void }> = ({ initial, onCommit, onCancel }) => {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    const name = value.trim();
    if (name && name !== initial) onCommit(name);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      value={value}
      aria-label="Name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          done.current = true;
          onCancel();
        }
      }}
      className="h-6 min-w-0 flex-1 rounded border border-ring bg-background px-1.5 text-[13px] text-foreground outline-none ring-2 ring-ring/25"
    />
  );
};

export const TreeView: React.FC<TreeViewProps> = ({
  nodes,
  selectedNodeId,
  editingNodeId,
  onNodeSelect,
  onNodeDoubleClick,
  onRenameNode,
  onDeleteNode,
  onCreateNode,
  onStartEdit,
  onEndEdit,
  editable = false,
  activeNodeId = null,
  highlight,
  onDuplicateNode,
  onMoveNode,
  canMoveNode,
  collapsedIds,
  onCollapsedIdsChange,
  hideCounts = false,
  'aria-label': ariaLabel = 'Collections',
}) => {
  const { addToast } = useToast();
  const [internalCollapsed, setInternalCollapsed] = useState<string[]>([]);
  const collapsed = collapsedIds ?? internalCollapsed;
  const setCollapsed = useCallback(
    (next: string[]) => (onCollapsedIdsChange ? onCollapsedIdsChange(next) : setInternalCollapsed(next)),
    [onCollapsedIdsChange]
  );
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);
  const forceExpand = !!highlight?.trim();

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; position: DropPosition } | null>(null);
  const hoverExpandTimer = useRef<number | undefined>(undefined);
  const dndEnabled = editable && !!onMoveNode && !forceExpand;

  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (list: (TreeNode | RequestNode)[], level: number, parentId: string | null) => {
      list.forEach((node, i) => {
        const isContainer = node.type !== 'request';
        const expanded = isContainer && (forceExpand || !collapsedSet.has(node.id));
        out.push({ node, level, parentId, posinset: i + 1, setsize: list.length, isContainer, expanded });
        if (isContainer && expanded) walk(node.children, level + 1, node.id);
      });
    };
    walk(nodes, 0, null);
    return out;
  }, [nodes, collapsedSet, forceExpand]);

  const expand = useCallback(
    (ids: string[]) => {
      const toOpen = ids.filter((id) => collapsedSet.has(id));
      if (toOpen.length) setCollapsed(collapsed.filter((id) => !toOpen.includes(id)));
    },
    [collapsed, collapsedSet, setCollapsed]
  );

  const toggle = (id: string, open?: boolean) => {
    const isOpen = !collapsedSet.has(id);
    const next = open ?? !isOpen;
    if (next === isOpen) return;
    setCollapsed(next ? collapsed.filter((c) => c !== id) : [...collapsed, id]);
  };

  // Reveal the open request and any node being renamed.
  useEffect(() => {
    const target = editingNodeId ?? activeNodeId;
    if (!target) return;
    expand(findAncestorIds(nodes, target));
    const raf = requestAnimationFrame(() => rowRefs.current.get(target)?.scrollIntoView({ block: 'nearest' }));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodeId, editingNodeId]);

  const tabStopId =
    (focusedId && rows.some((r) => r.node.id === focusedId) && focusedId) ||
    (selectedNodeId && rows.some((r) => r.node.id === selectedNodeId) && selectedNodeId) ||
    rows[0]?.node.id;

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setFocusedId(id);
    rowRefs.current.get(id)?.focus();
  };

  const copyUrl = (node: TreeNode) => {
    if (node.type !== 'request') return;
    navigator.clipboard.writeText(node.request.url).then(
      () => addToast('URL copied', 'success'),
      () => addToast('Could not copy to clipboard', 'error')
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: Row, index: number) => {
    const { node } = row;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusRow(rows[Math.min(index + 1, rows.length - 1)]?.node.id);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusRow(rows[Math.max(index - 1, 0)]?.node.id);
        break;
      case 'Home':
        e.preventDefault();
        focusRow(rows[0]?.node.id);
        break;
      case 'End':
        e.preventDefault();
        focusRow(rows[rows.length - 1]?.node.id);
        break;
      case 'ArrowRight':
        if (!row.isContainer) break;
        e.preventDefault();
        if (!row.expanded) toggle(node.id, true);
        else if (rows[index + 1]?.parentId === node.id) focusRow(rows[index + 1].node.id);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (row.isContainer && row.expanded && !forceExpand) toggle(node.id, false);
        else if (row.parentId) focusRow(row.parentId);
        break;
      case 'Enter':
        e.preventDefault();
        onNodeSelect(node.id);
        if (node.type === 'request') onNodeDoubleClick(node);
        else toggle(node.id);
        break;
      case ' ':
        e.preventDefault();
        onNodeSelect(node.id);
        break;
      case 'F2':
        if (!editable) break;
        e.preventDefault();
        onStartEdit(node.id);
        break;
      case 'Delete':
      case 'Backspace':
        if (!editable) break;
        e.preventDefault();
        onDeleteNode(node.id);
        break;
    }
  };

  // ---- Drag and drop ----
  const positionFor = (e: React.DragEvent, row: Row): DropPosition => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    if (row.isContainer) {
      if (row.node.type === 'collection' && dragId && rows.find((r) => r.node.id === dragId)?.node.type === 'collection') {
        return y < 0.5 ? 'before' : 'after';
      }
      if (row.node.type === 'collection') return 'inside';
      return y < 0.25 ? 'before' : y > 0.75 && !row.expanded ? 'after' : 'inside';
    }
    return y < 0.5 ? 'before' : 'after';
  };

  const onDragOver = (e: React.DragEvent, row: Row) => {
    if (!dragId) return;
    const position = positionFor(e, row);
    if (canMoveNode && !canMoveNode(dragId, row.node.id, position)) {
      if (drop) setDrop(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (drop?.id !== row.node.id || drop.position !== position) {
      setDrop({ id: row.node.id, position });
      window.clearTimeout(hoverExpandTimer.current);
      if (position === 'inside' && row.isContainer && !row.expanded) {
        hoverExpandTimer.current = window.setTimeout(() => toggle(row.node.id, true), 600);
      }
    }
  };

  const endDrag = () => {
    window.clearTimeout(hoverExpandTimer.current);
    setDragId(null);
    setDrop(null);
  };

  const renderMenu = (
    node: TreeNode,
    Item: React.ComponentType<React.ButtonHTMLAttributes<HTMLButtonElement> & { destructive?: boolean }>,
    Separator: React.ComponentType
  ) => (
    <>
      {node.type === 'request' && (
        <Item onClick={() => onNodeDoubleClick(node)}>
          <ExternalLink /> Open
        </Item>
      )}
      {node.type !== 'request' && (
        <>
          <Item onClick={() => onCreateNode('request', node.id)}>
            <FilePlus /> New request
          </Item>
          <Item onClick={() => onCreateNode('folder', node.id)}>
            <FolderPlus /> New folder
          </Item>
          <Separator />
        </>
      )}
      <Item onClick={() => onStartEdit(node.id)}>
        <Pencil /> Rename
        <span className="ml-auto pl-4 text-[11px] text-muted-foreground">F2</span>
      </Item>
      {onDuplicateNode && (
        <Item onClick={() => onDuplicateNode(node.id)}>
          <CopyPlus /> Duplicate
        </Item>
      )}
      {node.type === 'request' && (
        <Item onClick={() => copyUrl(node)} disabled={!node.request.url}>
          <Copy /> Copy URL
        </Item>
      )}
      <Separator />
      <Item destructive onClick={() => onDeleteNode(node.id)}>
        <Trash2 /> Delete
      </Item>
    </>
  );

  if (rows.length === 0) return null;

  return (
    <div role="tree" aria-label={ariaLabel} className="flex flex-col py-0.5" onDragEnd={endDrag}>
      {rows.map((row, index) => {
        const { node, level, isContainer, expanded } = row;
        const isSelected = selectedNodeId === node.id;
        const isActive = activeNodeId === node.id;
        const isEditing = editingNodeId === node.id;
        const isDropInside = drop?.id === node.id && drop.position === 'inside';
        const method = node.type === 'request' ? node.request.method : '';
        const count = isContainer && !hideCounts ? countRequests(node) : null;
        const ContainerIcon = node.type === 'collection' ? FolderKanban : expanded ? FolderOpen : FolderClosed;

        const rowEl = (
          <div
            ref={(el) => {
              if (el) rowRefs.current.set(node.id, el);
              else rowRefs.current.delete(node.id);
            }}
            role="treeitem"
            aria-level={level + 1}
            aria-posinset={row.posinset}
            aria-setsize={row.setsize}
            aria-expanded={isContainer ? expanded : undefined}
            aria-selected={isSelected}
            aria-current={isActive ? 'page' : undefined}
            tabIndex={node.id === tabStopId ? 0 : -1}
            title={node.type === 'request' && node.request.url ? `${node.name}\n${node.request.method} ${node.request.url}` : node.name}
            draggable={dndEnabled && !isEditing}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', node.id);
              setDragId(node.id);
            }}
            onDragOver={(e) => onDragOver(e, row)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node) && drop?.id === node.id) setDrop(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && drop) {
                onMoveNode?.(dragId, drop.id, drop.position);
                if (drop.position === 'inside') expand([drop.id]);
              }
              endDrag();
            }}
            onFocus={(e) => {
              if (e.target === e.currentTarget) setFocusedId(node.id);
            }}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              handleKeyDown(e, row, index);
            }}
            onClick={() => {
              if (isEditing) return;
              setFocusedId(node.id);
              onNodeSelect(node.id);
              if (isContainer) toggle(node.id);
            }}
            onDoubleClick={() => {
              if (!isEditing && node.type === 'request') onNodeDoubleClick(node);
            }}
            style={{ paddingLeft: 6 + level * 14 }}
            className={`group relative flex h-8 flex-shrink-0 cursor-pointer md:h-7 select-none items-center gap-1.5 rounded-md pr-1 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
              isDropInside
                ? 'bg-primary/10 ring-1 ring-inset ring-primary'
                : isActive
                  ? 'bg-primary/10 text-foreground'
                  : isSelected
                    ? 'bg-accent text-foreground'
                    : 'text-foreground/90 hover:bg-accent/60'
            } ${dragId === node.id ? 'opacity-50' : ''}`}
          >
            {isActive && <span aria-hidden="true" className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" />}
            {drop?.id === node.id && drop.position !== 'inside' && (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-2 right-1 h-0.5 rounded-full bg-primary ${drop.position === 'before' ? '-top-px' : '-bottom-px'}`}
              />
            )}
            {isContainer ? (
              <span className="flex w-[34px] flex-shrink-0 items-center gap-0.5 text-muted-foreground">
                <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
                <ContainerIcon className={`h-4 w-4 flex-shrink-0 ${node.type === 'collection' ? 'text-primary' : ''}`} />
              </span>
            ) : (
              <span className={`w-[34px] flex-shrink-0 pl-0.5 font-mono text-[10px] font-semibold tracking-tight ${getMethodClass(method)}`}>
                {getMethodShort(method)}
              </span>
            )}
            {isEditing ? (
              <RenameInput
                initial={node.name}
                onCommit={(name) => {
                  onRenameNode(node.id, name);
                  onEndEdit();
                  requestAnimationFrame(() => rowRefs.current.get(node.id)?.focus());
                }}
                onCancel={() => {
                  onEndEdit();
                  requestAnimationFrame(() => rowRefs.current.get(node.id)?.focus());
                }}
              />
            ) : (
              <span className={`min-w-0 flex-1 truncate ${node.type === 'collection' ? 'font-medium' : ''}`}>
                <Highlight text={node.name} query={highlight} />
              </span>
            )}
            {!isEditing && count !== null && (
              <span className={`flex-shrink-0 px-1 text-[11px] tabular-nums text-muted-foreground ${editable ? 'group-hover:hidden group-focus-visible:hidden group-has-[[aria-expanded=true]]:hidden [@media(pointer:coarse)]:hidden' : ''}`}>
                {count}
              </span>
            )}
            {editable && !isEditing && (
              <span
                className="hidden flex-shrink-0 items-center group-hover:flex group-focus-visible:flex has-[[aria-expanded=true]]:flex [@media(pointer:coarse)]:flex"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                {isContainer && (
                  <Tooltip content="New request" side="bottom">
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={`New request in ${node.name}`}
                      onClick={() => onCreateNode('request', node.id)}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/60 hover:text-foreground focus-ring"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                )}
                <DropdownMenu>
                  <Tooltip content="More actions" side="bottom">
                    <DropdownMenuTrigger
                      tabIndex={-1}
                      aria-label={`Actions for ${node.name}`}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/60 hover:text-foreground focus-ring aria-expanded:bg-background/60 aria-expanded:text-foreground"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                  </Tooltip>
                  <DropdownMenuContent className="w-48">{renderMenu(node, DropdownMenuItem, DropdownMenuSeparator)}</DropdownMenuContent>
                </DropdownMenu>
              </span>
            )}
          </div>
        );

        if (!editable) return <React.Fragment key={node.id}>{rowEl}</React.Fragment>;
        return (
          <ContextMenu key={node.id}>
            <ContextMenuTrigger>{rowEl}</ContextMenuTrigger>
            <ContextMenuContent className="w-52">{renderMenu(node, ContextMenuItem, ContextMenuSeparator)}</ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
};
