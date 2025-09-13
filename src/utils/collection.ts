import { v4 as uuidv4 } from 'uuid';
import { ApiRequest, Collection, Folder, RequestItem, RequestNode, Workspace } from '../types';

export const createDefaultRequest = (): ApiRequest => ({
  method: 'GET',
  url: '',
  queryParams: [{ id: Date.now(), key: '', value: '', enabled: true, encode: true }],
  headers: [{ id: Date.now(), key: '', value: '', enabled: true }],
  auth: { type: 'none' },
  body: { type: 'none' },
  settings: { sslVerification: true, followRedirects: true },
});

export const getUniqueNodeName = (nodes: (RequestNode | Collection)[], baseName: string): string => {
    const existingNames = new Set(nodes.map(n => n.name));
    
    if (!existingNames.has(baseName)) {
        return baseName;
    }

    let i = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const newName = `${baseName} (${i})`;
        if (!existingNames.has(newName)) {
            return newName;
        }
        i++;
    }
};

export const findNode = (workspace: Workspace, nodeId: string): RequestNode | Collection | undefined => {
    const search = (nodes: (RequestNode | Collection)[]): RequestNode | Collection | undefined => {
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

export const updateNode = (workspace: Workspace, nodeId: string, updater: (node: RequestNode | Collection) => RequestNode | Collection): Workspace => {
    const update = (nodes: (RequestNode | Collection)[]): (RequestNode | Collection)[] => {
        return nodes.map(node => {
            if (node.id === nodeId) {
                return updater(node);
            }
            if (node.type !== 'request') {
                return { ...node, children: update(node.children) as RequestNode[] };
            }
            return node;
        });
    };

    return { ...workspace, collections: update(workspace.collections) as Collection[] };
};

export const deleteNode = (workspace: Workspace, nodeId: string): Workspace => {
    const remove = (nodes: (RequestNode | Collection)[]): (RequestNode | Collection)[] => {
        return nodes.filter(node => {
            if (node.id === nodeId) return false;
            if (node.type !== 'request') {
                node.children = remove(node.children) as RequestNode[];
            }
            return true;
        });
    };
    return { ...workspace, collections: remove(workspace.collections) as Collection[] };
};

export const addNode = (workspace: Workspace, newNode: RequestNode, parentId?: string): Workspace => {
    if (!parentId) { // Adding a new collection
        if (newNode.type === 'request' || newNode.type === 'folder') throw new Error("Cannot add request or folder at root");
        return { ...workspace, collections: [...workspace.collections, newNode as Collection] };
    }

    const add = (nodes: (RequestNode | Collection)[]): (RequestNode | Collection)[] => {
        return nodes.map(node => {
            if (node.id === parentId && node.type !== 'request') {
                return { ...node, children: [...node.children, newNode] };
            }
            if (node.type !== 'request') {
                return { ...node, children: add(node.children) as RequestNode[] };
            }
            return node;
        });
    };
    
    return { ...workspace, collections: add(workspace.collections) as Collection[] };
};