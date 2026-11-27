import { describe, it, expect } from 'vitest';
import { runTestScript } from './scripting';
import { ApiResponse } from '../types';

const response = (body: unknown): ApiResponse => ({
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
  duration: 1,
  size: { headers: 0, body: 0, total: 0 },
  cookies: [],
});

const run = (body: unknown, script: string) =>
  runTestScript(script, response(body), {});

describe('pm.expect().to.include()', () => {
  it('checks substrings', () => {
    const pass = run('{"greeting":"foobar"}', `pm.test("sub", () => { pm.expect(pm.response.json().greeting).to.include("foo"); })`);
    expect(pass[0].passed).toBe(true);

    const fail = run('{"greeting":"foobar"}', `pm.test("sub", () => { pm.expect(pm.response.json().greeting).to.include("zzz"); })`);
    expect(fail[0].passed).toBe(false);
  });

  it('checks arrays', () => {
    const pass = run({ tags: ['a', 'b'] }, `pm.test("arr", () => { pm.expect(pm.response.json().tags).to.include("b"); })`);
    expect(pass[0].passed).toBe(true);

    const fail = run({ tags: ['a', 'b'] }, `pm.test("arr", () => { pm.expect(pm.response.json().tags).to.include("c"); })`);
    expect(fail[0].passed).toBe(false);
  });

  it('checks object subsets', () => {
    const pass = run({ user: { id: 1, name: 'a' } }, `pm.test("obj", () => { pm.expect(pm.response.json().user).to.include({ id: 1 }); })`);
    expect(pass[0].passed).toBe(true);

    const fail = run({ user: { id: 1, name: 'a' } }, `pm.test("obj", () => { pm.expect(pm.response.json().user).to.include({ id: 2 }); })`);
    expect(fail[0].passed).toBe(false);
  });
});
