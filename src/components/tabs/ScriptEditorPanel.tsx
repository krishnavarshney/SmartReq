import React, { useState } from 'react';
import { CodeEditor } from '../ui/CodeEditor';
import { Button } from '../ui/Button';
import { Sparkles } from '../icons';
import { AiScriptGeneratorModal } from '../modals/AiScriptGeneratorModal';

interface ScriptEditorPanelProps {
  script: string;
  onScriptChange: (script: string) => void;
  type: 'pre-request' | 'test';
}

export const ScriptEditorPanel: React.FC<ScriptEditorPanelProps> = ({ script, onScriptChange, type }) => {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const handleGeneratedScript = (generatedScript: string) => {
    onScriptChange(script ? `${script}\n\n${generatedScript}` : generatedScript);
  };

  return (
    <div className="h-full flex flex-col">
       <div className="flex items-center justify-end p-2 border-b border-border flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={() => setIsAiModalOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2 text-yellow-400" /> AI Generate
          </Button>
      </div>
      <div className="flex-grow relative">
        <CodeEditor
          value={script}
          onChange={onScriptChange}
          language="javascript"
        />
      </div>
      {isAiModalOpen && (
        <AiScriptGeneratorModal
          show={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onGenerate={handleGeneratedScript}
          type={type}
        />
      )}
    </div>
  );
};
