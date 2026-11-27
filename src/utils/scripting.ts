import { ApiResponse, TestResult } from '../types';

class Expectation {
    constructor(private value: any) {}

    private isEqual(a: any, b: any): boolean {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    
    to: {
        eql: (expected: any) => void;
        have: {
            property: (prop: string) => void;
        },
        be: {
            a: (type: 'string' | 'number' | 'boolean' | 'object' | 'array') => void;
        },
        include: (subset: any) => void;
    } = {
        eql: (expected: any) => {
            if (!this.isEqual(this.value, expected)) {
                throw new Error(`expected ${JSON.stringify(this.value)} to deeply equal ${JSON.stringify(expected)}`);
            }
        },
        have: {
            property: (prop: string) => {
                if (typeof this.value !== 'object' || this.value === null || !(prop in this.value)) {
                    throw new Error(`expected ${JSON.stringify(this.value)} to have property '${prop}'`);
                }
            }
        },
        be: {
            a: (type: 'string' | 'number' | 'boolean' | 'object' | 'array') => {
                 const actualType = Array.isArray(this.value) ? 'array' : typeof this.value;
                 if(actualType !== type) {
                     throw new Error(`expected ${JSON.stringify(this.value)} to be a ${type}`);
                 }
            }
        },
        include: (subset: any) => {
            const value = this.value;
            let passed: boolean;
            if (Array.isArray(value)) {
                passed = value.some(item => this.isEqual(item, subset));
            } else if (typeof value === 'string') {
                passed = value.includes(String(subset));
            } else if (value && typeof value === 'object') {
                passed = Object.entries(subset ?? {}).every(([k, v]) => this.isEqual((value as any)[k], v));
            } else {
                passed = false;
            }
            if (!passed) {
                throw new Error(`expected ${JSON.stringify(value)} to include ${JSON.stringify(subset)}`);
            }
        }
    }
}

export const runTestScript = (script: string, response: ApiResponse, env: Record<string, any>): TestResult[] => {
    const results: TestResult[] = [];
    
    const pm = {
        response: {
            ...response,
            json: () => {
                try {
                    return typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
                } catch (e) {
                    throw new Error("Response body is not valid JSON");
                }
            },
            text: () => String(response.body),
            to: {
                have: {
                    status: (code: number) => {
                        results.push({ name: `Status code is ${code}`, passed: response.status === code, error: response.status === code ? undefined : `Expected status ${code} but got ${response.status}`});
                    },
                    header: (key: string) => {
                         const hasHeader = Object.keys(response.headers).some(h => h.toLowerCase() === key.toLowerCase());
                         results.push({ name: `Header '${key}' is present`, passed: hasHeader, error: hasHeader ? undefined : `Expected header '${key}' to be present` });
                    }
                }
            }
        },
        test: (name: string, callback: () => void) => {
            try {
                callback();
                results.push({ name, passed: true });
            } catch (e: any) {
                results.push({ name, passed: false, error: e.message });
            }
        },
        expect: (value: any) => new Expectation(value),
        globals: {
            get: (key: string) => env[key],
        }
    };

    try {
        const sandboxedFunction = new Function('pm', script);
        sandboxedFunction(pm);
    } catch (e: any) {
        results.push({ name: "Script execution error", passed: false, error: e.message });
    }
    
    return results;
};