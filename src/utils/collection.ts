import { v4 as uuidv4 } from 'uuid';
import { ApiRequest, Collection, RequestNode, Workspace } from '../types';

type AnyNode = RequestNode | Collection;
export type DropPosition = 'before' | 'after' | 'inside';

export const createDefaultRequest = (): ApiRequest => ({
  method: 'GET',
  url: '',
  queryParams: [{ id: Date.now(), key: '', value: '', enabled: true, encode: true }],
  headers: [{ id: Date.now(), key: '', value: '', enabled: true }],
  auth: { type: 'none' },
  body: { type: 'none' },
  settings: { sslVerification: true, followRedirects: true },
});

export const getUniqueNodeName = (nodes: { name: string }[], baseName: string): string => {
  const existingNames = new Set(nodes.map((n) => n.name));
  if (!existingNames.has(baseName)) return baseName;
  let i = 2;
  while (existingNames.has(`${baseName} (${i})`)) i++;
  return `${baseName} (${i})`;
};

export const findNode = (workspace: Workspace, nodeId: string): AnyNode | undefined => {
  const search = (nodes: AnyNode[]): AnyNode | undefined => {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      if (node.type !== 'request') {
        const found = search(node.children);
        if (found) return found;
      }
    }
    return undefined;
  };
  return search(workspace.collections);
};

/** Ids of every container above `nodeId`, outermost first. Empty if not found or top level. */
export const findAncestorIds = (nodes: AnyNode[], nodeId: string): string[] => {
  const walk = (list: AnyNode[], trail: string[]): string[] | null => {
    for (const node of list) {
      if (node.id === nodeId) return trail;
      if (node.type !== 'request') {
        const found = walk(node.children, [...trail, node.id]);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(nodes, []) ?? [];
};

/** Number of requests inside a node (recursively). A request counts as one. */
export const countRequests = (node: AnyNode): number =>
  node.type === 'request' ? 1 : node.children.reduce((sum, child) => sum + countRequests(child), 0);

export const updateNode = (workspace: Workspace, nodeId: string, updater: (node: AnyNode) => AnyNode): Workspace => {
  const update = (nodes: AnyNode[]): AnyNode[] =>
    nodes.map((node) => {
      if (node.id === nodeId) return updater(node);
      if (node.type !== 'request') return { ...node, children: update(node.children) as RequestNode[] };
      return node;
    });
  return { ...workspace, collections: update(workspace.collections) as Collection[] };
};

const removeFromTree = (nodes: AnyNode[], nodeId: string): AnyNode[] =>
  nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => (node.type !== 'request' ? { ...node, children: removeFromTree(node.children, nodeId) as RequestNode[] } : node));

export const deleteNode = (workspace: Workspace, nodeId: string): Workspace => ({
  ...workspace,
  collections: removeFromTree(workspace.collections, nodeId) as Collection[],
});

export const addNode = (workspace: Workspace, newNode: RequestNode | Collection, parentId?: string): Workspace => {
  if (!parentId) {
    if (newNode.type !== 'collection') throw new Error('Cannot add request or folder at root');
    return { ...workspace, collections: [...workspace.collections, newNode] };
  }
  const add = (nodes: AnyNode[]): AnyNode[] =>
    nodes.map((node) => {
      if (node.id === parentId && node.type !== 'request') return { ...node, children: [...node.children, newNode as RequestNode] };
      if (node.type !== 'request') return { ...node, children: add(node.children) as RequestNode[] };
      return node;
    });
  return { ...workspace, collections: add(workspace.collections) as Collection[] };
};

/** Deep copy with fresh ids (responses are history, so they are not copied). */
export const cloneWithNewIds = <T extends AnyNode>(node: T): T => {
  if (node.type === 'request') {
    return { ...structuredClone(node), id: uuidv4(), responses: [] } as T;
  }
  return { ...node, id: uuidv4(), children: node.children.map((c) => cloneWithNewIds(c)) } as T;
};

/** Insert a copy of `nodeId` right after it, named "<name> copy". Returns the new workspace and id. */
export const duplicateNode = (workspace: Workspace, nodeId: string): { workspace: Workspace; newId: string | null } => {
  let newId: string | null = null;
  const dup = (nodes: AnyNode[]): AnyNode[] => {
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx >= 0) {
      const copy = cloneWithNewIds(nodes[idx]);
      copy.name = getUniqueNodeName(nodes, `${nodes[idx].name} copy`);
      newId = copy.id;
      return [...nodes.slice(0, idx + 1), copy, ...nodes.slice(idx + 1)];
    }
    return nodes.map((n) => (n.type !== 'request' ? { ...n, children: dup(n.children) as RequestNode[] } : n));
  };
  const collections = dup(workspace.collections) as Collection[];
  return { workspace: { ...workspace, collections }, newId };
};

const containsId = (node: AnyNode, id: string): boolean =>
  node.id === id || (node.type !== 'request' && node.children.some((c) => containsId(c, id)));

/** Can `dragId` be dropped relative to `targetId` at `position`? */
export const canMoveNode = (workspace: Workspace, dragId: string, targetId: string, position: DropPosition): boolean => {
  if (dragId === targetId) return false;
  const drag = findNode(workspace, dragId);
  const target = findNode(workspace, targetId);
  if (!drag || !target) return false;
  if (containsId(drag, targetId)) return false; // never into own subtree
  if (drag.type === 'collection') return target.type === 'collection' && position !== 'inside';
  if (target.type === 'collection') return position === 'inside';
  if (position === 'inside') return target.type === 'folder';
  return true;
};

/** Move a node relative to another one. No-op when the move is invalid. */
export const moveNode = (workspace: Workspace, dragId: string, targetId: string, position: DropPosition): Workspace => {
  if (!canMoveNode(workspace, dragId, targetId, position)) return workspace;
  const drag = findNode(workspace, dragId)!;
  const without = removeFromTree(workspace.collections, dragId);

  const insert = (nodes: AnyNode[]): AnyNode[] => {
    const idx = nodes.findIndex((n) => n.id === targetId);
    if (idx >= 0) {
      const target = nodes[idx];
      if (position === 'inside' && target.type !== 'request') {
        const updated = { ...target, children: [...target.children, drag as RequestNode] };
        return [...nodes.slice(0, idx), updated, ...nodes.slice(idx + 1)];
      }
      const at = position === 'before' ? idx : idx + 1;
      return [...nodes.slice(0, at), drag, ...nodes.slice(at)];
    }
    return nodes.map((n) => (n.type !== 'request' ? { ...n, children: insert(n.children) as RequestNode[] } : n));
  };
  return { ...workspace, collections: insert(without) as Collection[] };
};
