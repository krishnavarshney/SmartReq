import { describe, it, expect } from 'vitest';
import { coerceToTypeOf, countCombinations, generateCombinations, listJsonPaths, planBodyCombinations } from './combinatorics';
import { interpolateString } from './interpolation';

describe('combinations', () => {
  it('counts and generates the cartesian product, ignoring empty lists', () => {
    const vars = { a: ['1', '2'], b: ['x', 'y', 'z'], c: [] };
    expect(countCombinations(vars)).toBe(6);
    expect(generateCombinations(vars)).toHaveLength(6);
    expect(countCombinations({ a: [] })).toBe(0);
  });

  it('coerces to the original field type', () => {
    expect(coerceToTypeOf('5', 1)).toBe(5);
    expect(coerceToTypeOf('abc', 1)).toBe('abc');
    expect(coerceToTypeOf('true', false)).toBe(true);
    expect(coerceToTypeOf('[1]', [])).toEqual([1]);
    expect(coerceToTypeOf('5', 'x')).toBe('5');
  });

  it('lists leaf paths', () => {
    expect(listJsonPaths({ a: 1, b: { c: 2, d: [3] } })).toEqual(['a', 'b.c', 'b.d.0']);
  });
});

describe('planBodyCombinations', () => {
  const base = { name: 'x', age: 1, address: { city: 'c' } };
  const plan = planBodyCombinations(base, { name: ['Al "Bo"', 'Cy'], age: ['30'] }, [{ key: 'address.city', template: 'Home of {{name}}' }]);

  it('builds a typed template', () => {
    expect(plan.template).toContain('"name": "{{name}}"');
    expect(plan.template).toContain('"age": {{age}}');
    expect(plan.template).toContain('"city": "{{address.city}}"');
  });

  it('rows interpolate back into valid JSON equal to the previewed bodies', () => {
    plan.rows.forEach((row, i) => {
      const vars = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
      expect(JSON.parse(interpolateString(plan.template, vars))).toEqual(plan.bodies[i]);
    });
    expect(plan.bodies[0]).toEqual({ name: 'Al "Bo"', age: 30, address: { city: 'Home of Al "Bo"' } });
  });
});

describe('generateCombinations limit', () => {
  it('builds only `limit` rows of a huge product, in row-major order', () => {
    const many = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`k${i}`, Array.from({ length: 15 }, (_, j) => String(j))]));
    expect(countCombinations(many)).toBe(15 ** 6);
    const start = Date.now();
    const rows = generateCombinations(many, 3);
    expect(Date.now() - start).toBeLessThan(50);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ k0: '0', k1: '0', k2: '0', k3: '0', k4: '0', k5: '0' });
    expect(rows[1].k5).toBe('1');
  });

  it('matches the full product order', () => {
    expect(generateCombinations({ a: ['1', '2'], b: ['x', 'y'] })).toEqual([
      { a: '1', b: 'x' },
      { a: '1', b: 'y' },
      { a: '2', b: 'x' },
      { a: '2', b: 'y' },
    ]);
  });
});
