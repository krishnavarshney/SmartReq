import { describe, it, expect } from 'vitest';
import { moveNode, duplicateNode, deleteNode, canMoveNode, findAncestorIds } from './collection';
import { Workspace } from '../types';

const req = (id: string) => ({ id, type: 'request' as const, name: id, request: { method: 'GET' as const, url: '', queryParams: [], headers: [], auth: { type: 'none' as const }, body: { type: 'none' as const }, settings: { sslVerification: true, followRedirects: true } }, responses: [] });
const ws = (): Workspace => ({
  id: 'w', name: 'w', globals: [], environments: [], activeEnvironmentId: null, flows: [],
  collections: [
    { id: 'c1', type: 'collection', name: 'C1', children: [req('r1'), { id: 'f1', type: 'folder', name: 'F1', children: [req('r2')] }] },
    { id: 'c2', type: 'collection', name: 'C2', children: [] },
  ],
});

describe('collection tree utils', () => {
  it('moves a request into another collection and before a sibling', () => {
    let w = moveNode(ws(), 'r1', 'c2', 'inside');
    expect(w.collections[1].children.map((n) => n.id)).toEqual(['r1']);
    w = moveNode(w, 'r2', 'r1', 'before');
    expect(w.collections[1].children.map((n) => n.id)).toEqual(['r2', 'r1']);
  });
  it('refuses moving a folder into itself and collections into folders', () => {
    expect(canMoveNode(ws(), 'f1', 'r2', 'before')).toBe(false);
    expect(canMoveNode(ws(), 'c1', 'f1', 'inside')).toBe(false);
    expect(canMoveNode(ws(), 'c2', 'c1', 'before')).toBe(true);
  });
  it('duplicates with fresh ids right after the original', () => {
    const { workspace, newId } = duplicateNode(ws(), 'f1');
    const kids = workspace.collections[0].children;
    expect(kids.map((n) => n.name)).toEqual(['r1', 'F1', 'F1 copy']);
    expect(kids[2].id).toBe(newId);
    expect(kids[2].type === 'folder' && kids[2].children[0].id).not.toBe('r2');
  });
  it('deletes without mutating the input', () => {
    const before = ws();
    const after = deleteNode(before, 'r2');
    expect(before.collections[0].children[1].type === 'folder' && before.collections[0].children[1].children.length).toBe(1);
    expect(after.collections[0].children[1].type === 'folder' && after.collections[0].children[1].children.length).toBe(0);
  });
  it('finds ancestors', () => {
    expect(findAncestorIds(ws().collections, 'r2')).toEqual(['c1', 'f1']);
  });
});
