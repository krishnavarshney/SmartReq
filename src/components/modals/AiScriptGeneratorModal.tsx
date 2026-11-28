import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Sparkles, Settings } from '../icons';
import { useToast } from '../../context/ToastContext';
import { useApiKey } from '../../hooks/useApiKey';
import { useApp } from '../../context/AppContext';
import { EmptyState } from '../ui/EmptyState';
import { MOD_KEY } from '../Header';

interface AiScriptGeneratorModalProps {
  show: boolean;
  onClose: () => void;
  onGenerate: (script: string) => void;
  type: 'pre-request' | 'test';
}

const getSystemInstruction = (type: 'pre-request' | 'test') => {
  if (type === 'pre-request') {
    return `You write pre-request scripts for a browser-based API client. The script is plain synchronous JavaScript (no imports, no require, no await) with a 'pm' object:
- pm.variables.get(name) / pm.variables.set(name, value): variables used as {{name}} in the request (pm.environment and pm.globals are aliases). Changes apply to this send only.
- pm.request.url (read/write string), pm.request.method (read/write)
- pm.request.headers.upsert({ key, value }), .add({ key, value }), .remove(key), .get(key)
- pm.request.body.raw (read-only string)
- Standard browser globals are available: crypto.randomUUID(), crypto.getRandomValues, btoa, atob, Date, Math, JSON, console.
There is no CryptoJS and no network access.
Respond ONLY with raw JavaScript. No markdown fences, no explanations.`;
  }
  return `You write test scripts for a browser-based API client. The script is plain synchronous JavaScript with a 'pm' object:
- pm.response.json(), pm.response.text(), pm.response.code (number), pm.response.responseTime (ms), pm.response.headers.get(name)
- pm.test("name", () => { ... }) groups assertions.
- pm.expect(value) supports chai-style: .to.equal(), .to.eql(), .to.be.a('string'|'number'|'array'|'object'|'boolean'), .to.have.property(name[, value]), .to.include(), .to.have.lengthOf(n), .to.be.above(n)/.below(n), .to.be.oneOf([...]), .to.match(/re/), .to.exist, .to.be.true/.false/.null/.empty, and .not.
- pm.response.to.have.status(200), pm.response.to.have.header("Content-Type")
- pm.variables.get(name)
Respond ONLY with raw JavaScript. No markdown fences, no explanations.`;
};

const EXAMPLES: Record<'pre-request' | 'test', string[]> = {
  'pre-request': ['Add an X-Request-Id header with a random UUID', 'Set a "timestamp" variable to the current Unix time', 'Sign the body with an HMAC header from the "secret" variable'],
  test: ['Status is 200 and the body has an id', 'Response time is under 500ms', 'Every item in "posts" has a numeric id and a title'],
};

export const AiScriptGeneratorModal: React.FC<AiScriptGeneratorModalProps> = ({ show, onClose, onGenerate, type }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const apiKey = useApiKey();
  const { setIsSettingsOpen } = useApp();

  const handleGenerate = async () => {
    if (!apiKey || !prompt.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: getSystemInstruction(type) },
      });
      const script = (response.text ?? '').replace(/^```(?:javascript|js)?\s*|```\s*$/g, '').trim();
      if (!script) throw new Error('The model returned an empty script.');
      onGenerate(script);
      addToast('Script added', 'success');
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(/dynamically imported module/i.test(message) ? 'Could not load the AI module. Check your connection.' : `Generation failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const title = type === 'test' ? 'Generate tests' : 'Generate pre-request script';

  if (!apiKey) {
    return (
      <Modal show={show} onClose={onClose} size="md" icon={<Sparkles />} title={title}>
        <EmptyState
          compact
          icon={<Settings />}
          title="Add a Gemini API key"
          message="AI generation uses your own Gemini API key, stored only in this browser."
        >
          <Button
            onClick={() => {
              onClose();
              setIsSettingsOpen(true);
            }}
          >
            Open settings
          </Button>
        </EmptyState>
      </Modal>
    );
  }

  return (
    <Modal
      show={show}
      onClose={onClose}
      size="lg"
      icon={<Sparkles />}
      title={title}
      description="Describe what the script should do. The result is appended to the editor so you can review it."
      dismissible={!isLoading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} isLoading={isLoading} disabled={!prompt.trim()}>
            {!isLoading && <Sparkles className="h-3.5 w-3.5" />}
            {isLoading ? 'Generating' : 'Generate'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Textarea
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleGenerate();
            }
          }}
          placeholder={EXAMPLES[type][0]}
          aria-label="Describe the script"
          className="min-h-[96px]"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Try:</span>
          {EXAMPLES[type].map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
            >
              {ex}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{MOD_KEY} Enter to generate</p>
        {error && (
          <p role="alert" className="rounded-md bg-destructive-bg px-3 py-2 text-xs text-destructive-text">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
};
