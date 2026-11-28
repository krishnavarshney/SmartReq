import { describe, it, expect } from 'vitest';
import { ApiResponse } from '../../types';
import { createDefaultRequest } from '../../utils/collection';
import { buildFinalRequest } from '../../api';
import {
  getValueAtPath,
  parsePath,
  extractVariables,
  resolveStepRef,
  buildStepData,
  findUnresolved,
  getFailureReason,
  StepRun,
} from './flowRunner';

const response = (body: unknown, extra: Partial<ApiResponse> = {}): ApiResponse => ({
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json', 'x-request-id': 'abc' },
  body,
  duration: 12,
  ...extra,
});

const user = { id: 7, name: 'Ada', posts: [{ id: 1, title: 'one' }, { id: 2 }], 'odd key': true };

describe('path lookup', () => {
  it('parses dotted, bracketed and $-prefixed paths', () => {
    expect(parsePath('$.posts[1].id')).toEqual(['posts', '1', 'id']);
    expect(parsePath("['odd key']")).toEqual(['odd key']);
    expect(parsePath('posts.0.title')).toEqual(['posts', '0', 'title']);
  });

  it('reads nested values and reports misses', () => {
    expect(getValueAtPath(user, 'posts[0].title')).toEqual({ found: true, value: 'one' });
    expect(getValueAtPath(user, 'posts.-1.id')).toEqual({ found: true, value: 2 });
    expect(getValueAtPath(user, 'posts[5].id').found).toBe(false);
    expect(getValueAtPath(user, 'missing').found).toBe(false);
    expect(getValueAtPath(user, '').value).toBe(user);
  });
});

describe('extractVariables', () => {
  it('extracts body and header values and warns on misses', () => {
    const { values, warnings } = extractVariables(
      [
        { id: '1', name: 'userId', source: 'BODY_JSON', path: 'id' },
        { id: '2', name: 'reqId', source: 'HEADER', path: 'X-Request-Id' },
        { id: '3', name: 'nope', source: 'BODY_JSON', path: 'a.b' },
        { id: '4', name: 'posts', source: 'BODY_JSON', path: 'posts[1]' },
      ],
      response(JSON.stringify(user))
    );
    expect(values).toEqual({ userId: '7', reqId: 'abc', posts: '{"id":2}' });
    expect(warnings).toHaveLength(1);
  });
});

describe('step references', () => {
  const previous: StepRun[] = [
    { nodeId: 'a', status: 'passed', extracted: {}, warnings: [], response: response(user) },
  ];

  it('resolves status, headers and body paths', () => {
    expect(resolveStepRef('steps.1.status', previous)).toEqual({ ok: true, value: '200' });
    expect(resolveStepRef('steps.1.headers.Content-Type', previous)).toEqual({ ok: true, value: 'application/json' });
    expect(resolveStepRef('steps.1.body.posts[0].id', previous)).toEqual({ ok: true, value: '1' });
    expect(resolveStepRef('steps.2.body.id', previous).ok).toBe(false);
  });

  it('feeds references and flow variables into buildFinalRequest', () => {
    const req = createDefaultRequest();
    req.url = 'http://x.test/users/{{steps.1.body.id}}/posts/{{postId}}?u={{missing}}';
    const { data, warnings } = buildStepData(req, previous, { postId: '9' });
    expect(warnings).toEqual([]);
    const final = buildFinalRequest(req, data, []);
    expect(final.url.split('?')[0]).toBe('http://x.test/users/7/posts/9');
    expect(findUnresolved(final)).toEqual(['missing']);
    req.url = 'http://x.test/a';
    req.headers = [{ id: 1, key: 'X-Trace', value: '{{other}}', enabled: true }];
    expect(findUnresolved(buildFinalRequest(req, data, []))).toEqual(['other']);
  });
});

describe('quoted bracket refs', () => {
  it('collects refs with double-quoted keys unescaped', () => {
    const prev: StepRun[] = [{ nodeId: 'a', status: 'passed', extracted: {}, warnings: [], response: response({ 'user id': 5 }) }];
    const req = createDefaultRequest();
    req.url = 'http://x.test/u/{{steps.1.body["user id"]}}';
    const { data, warnings } = buildStepData(req, prev, {});
    expect(warnings).toEqual([]);
    expect(buildFinalRequest(req, data, []).url).toBe('http://x.test/u/5');
  });
});

describe('getFailureReason', () => {
  it('treats network errors, 4xx/5xx and failing tests as failures', () => {
    expect(getFailureReason(response({}, { status: 0, statusText: 'Network Error' }))).toMatch(/did not complete/);
    expect(getFailureReason(response({}, { status: 500, statusText: 'Server Error' }))).toBe('Responded 500 Server Error');
    expect(getFailureReason(response({}, { testResults: [{ name: 't', passed: false }] }))).toMatch(/1 of 1 tests failed/);
    expect(getFailureReason(response({}))).toBeNull();
  });
});
