import { describe, it, expect } from 'vitest';
import { runPreRequestScript, runTestScript, expect as pmExpect } from './scripting';
import { ApiResponse } from '../types';

const res = (overrides: Partial<ApiResponse> = {}): ApiResponse => ({
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json' },
  body: { id: 1, tags: ['a'], name: 'Leanne' },
  duration: 120,
  ...overrides,
});

describe('expect()', () => {
  it('supports chains, negation and getters', () => {
    expect(() => pmExpect(5).to.be.above(3).and.below(10)).not.toThrow();
    expect(() => pmExpect([1, 2]).to.have.lengthOf(2)).not.toThrow();
    expect(() => pmExpect({ a: 1 }).to.have.property('a', 1)).not.toThrow();
    expect(() => pmExpect({ a: 1 }).to.have.property('a').that.is.a('number')).not.toThrow();
    expect(() => pmExpect(null).to.not.exist).not.toThrow();
    expect(() => pmExpect([]).to.be.an('array').that.is.empty).not.toThrow();
    expect(() => pmExpect(1).to.not.equal(1)).toThrow(/not equal/);
    expect(() => pmExpect({ a: [1] }).to.eql({ a: [1] })).not.toThrow();
    expect(() => pmExpect('abc').to.match(/b/)).not.toThrow();
    expect(() => pmExpect(true).to.be.false).toThrow();
  });
});

describe('runTestScript', () => {
  it('fails the enclosing test when a status assertion fails inside pm.test', () => {
    const results = runTestScript(`pm.test("ok", () => { pm.response.to.have.status(404); });`, res(), {});
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
  });

  it('records top-level response assertions as their own results', () => {
    const results = runTestScript(`pm.response.to.have.status(200); pm.response.to.have.header("Content-Type");`, res(), {});
    expect(results.map((r) => r.passed)).toEqual([true, true]);
  });

  it('exposes code, responseTime, headers and variables', () => {
    const results = runTestScript(
      `pm.test("t", () => {
        pm.expect(pm.response.code).to.equal(200);
        pm.expect(pm.response.responseTime).to.be.below(500);
        pm.expect(pm.response.headers.get("Content-Type")).to.include("json");
        pm.expect(pm.variables.get("BASEURL")).to.equal("http://x");
      });`,
      res(),
      { baseUrl: 'http://x' }
    );
    expect(results[0]).toEqual({ name: 't', passed: true });
  });

  it('reports script errors', () => {
    const results = runTestScript(`throw new Error("boom")`, res(), {});
    expect(results[0].passed).toBe(false);
    expect(results[0].error).toBe('boom');
  });
});

describe('runPreRequestScript', () => {
  it('sets variables, edits headers, url and method', () => {
    const out = runPreRequestScript(
      `pm.variables.set("Token", "abc");
       pm.request.headers.upsert({ key: "X-Id", value: "1" });
       pm.request.headers.remove("x-old");
       pm.request.url = pm.request.url + "?v=2";
       pm.request.method = "post";`,
      { method: 'GET', url: 'http://h/x', headers: [{ id: 1, key: 'X-Old', value: 'o', enabled: true }], variables: { a: '1' } }
    );
    expect(out.error).toBeUndefined();
    expect(out.variables).toEqual({ a: '1', token: 'abc' });
    expect(out.headers.map((h) => h.key)).toEqual(['X-Id']);
    expect(out.url).toBe('http://h/x?v=2');
    expect(out.method).toBe('POST');
  });

  it('returns the error message when the script throws', () => {
    const out = runPreRequestScript(`nope()`, { method: 'GET', url: 'u', headers: [], variables: {} });
    expect(out.error).toMatch(/nope/);
  });
});
