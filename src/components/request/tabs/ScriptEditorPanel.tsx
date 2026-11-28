import React, { useState } from 'react';
import { CodeEditor } from '../../ui/CodeEditor';
import { Button } from '../../ui/Button';
import { Sparkles, ChevronDown } from '../../icons';
import { AiScriptGeneratorModal } from '../../modals/AiScriptGeneratorModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../../ui/DropdownMenu';
import { TestResult } from '../../../types';

interface ScriptEditorPanelProps {
  script: string;
  onScriptChange: (script: string) => void;
  type: 'pre-request' | 'test';
  /** Results of the last run, shown under the test editor. */
  testResults?: TestResult[];
}

const PRE_REQUEST_SNIPPETS: { label: string; code: string }[] = [
  { label: 'Set a variable', code: `pm.variables.set("requestId", crypto.randomUUID());` },
  { label: 'Add a header', code: `pm.request.headers.upsert({ key: "X-Request-Id", value: pm.variables.get("requestId") || crypto.randomUUID() });` },
  { label: 'Timestamp variable', code: `pm.variables.set("now", new Date().toISOString());` },
  { label: 'Basic auth header from variables', code: `const user = pm.variables.get("username");\nconst pass = pm.variables.get("password");\npm.request.headers.upsert({ key: "Authorization", value: "Basic " + btoa(user + ":" + pass) });` },
  { label: 'Log the request', code: `console.log(pm.request.method, pm.request.url, pm.request.headers.toObject());` },
];

const TEST_SNIPPETS: { label: string; code: string }[] = [
  { label: 'Status code is 200', code: `pm.test("Status code is 200", () => {\n  pm.response.to.have.status(200);\n});` },
  { label: 'Response time below 500ms', code: `pm.test("Response time is below 500ms", () => {\n  pm.expect(pm.response.responseTime).to.be.below(500);\n});` },
  { label: 'Content-Type is JSON', code: `pm.test("Content-Type is JSON", () => {\n  pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");\n});` },
  { label: 'Body has property', code: `pm.test("Body has an id", () => {\n  const body = pm.response.json();\n  pm.expect(body).to.have.property("id");\n});` },
  { label: 'Property equals value', code: `pm.test("Name is correct", () => {\n  pm.expect(pm.response.json().name).to.eql("Leanne Graham");\n});` },
  { label: 'Body contains text', code: `pm.test("Body contains text", () => {\n  pm.expect(pm.response.text()).to.include("success");\n});` },
  { label: 'Array is not empty', code: `pm.test("Items are returned", () => {\n  pm.expect(pm.response.json().items).to.be.an("array").that.is.not.empty;\n});` },
];

const DOCS: Record<ScriptEditorPanelProps['type'], React.ReactNode> = {
  'pre-request': (
    <>
      Runs before every send. Use <code className="font-mono text-foreground">pm.variables.set()</code> and{' '}
      <code className="font-mono text-foreground">pm.request.headers.upsert()</code>; changes apply to that send only.
    </>
  ),
  test: (
    <>
      Runs after the response arrives. Write checks with <code className="font-mono text-foreground">pm.test()</code> and{' '}
      <code className="font-mono text-foreground">pm.expect()</code>.
    </>
  ),
};

export const ScriptEditorPanel: React.FC<ScriptEditorPanelProps> = ({ script, onScriptChange, type, testResults }) => {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const snippets = type === 'test' ? TEST_SNIPPETS : PRE_REQUEST_SNIPPETS;

  const append = (code: string) => onScriptChange(script.trim() ? `${script.replace(/\s+$/, '')}\n\n${code}\n` : `${code}\n`);

  const passed = testResults?.filter((r) => r.passed).length ?? 0;
  const failed = (testResults?.length ?? 0) - passed;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-10 flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{DOCS[type]}</p>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs">
                Snippets <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel>Insert snippet</DropdownMenuLabel>
              {snippets.map((s) => (
                <DropdownMenuItem key={s.label} onClick={() => append(s.code)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="xs" onClick={() => setIsAiModalOpen(true)}>
            <Sparkles /> Generate
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={script}
          onChange={onScriptChange}
          language="javascript"
          aria-label={type === 'test' ? 'Test script' : 'Pre-request script'}
          placeholder={type === 'test' ? '// e.g. pm.test("Status is 200", () => pm.response.to.have.status(200));' : '// e.g. pm.variables.set("timestamp", Date.now());'}
        />
      </div>
      {type === 'test' && testResults && testResults.length > 0 && (
        <div className="flex-shrink-0 border-t border-border px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">Last run: </span>
          <span className="text-success-text">{passed} passed</span>
          {failed > 0 && <span className="text-destructive-text"> · {failed} failed</span>}
          <span className="text-muted-foreground"> · details in the response's Tests tab</span>
        </div>
      )}
      {isAiModalOpen && <AiScriptGeneratorModal show onClose={() => setIsAiModalOpen(false)} onGenerate={append} type={type} />}
    </div>
  );
};
