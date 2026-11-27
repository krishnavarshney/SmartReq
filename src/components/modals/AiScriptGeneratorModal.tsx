import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Sparkles, Wand2 } from '../icons';
import { useToast } from '../../context/ToastContext';
import { Spinner } from '../ui/Spinner';
import { useApiKey } from '../../hooks/useApiKey';

interface AiScriptGeneratorModalProps {
  show: boolean;
  onClose: () => void;
  onGenerate: (script: string) => void;
  type: 'pre-request' | 'test';
}

const getSystemInstruction = (type: 'pre-request' | 'test') => {
  if (type === 'pre-request') {
    return `You are an expert JavaScript developer writing pre-request scripts for an API client.
The script runs in a sandbox with a 'pm' object available.
- 'pm.globals.set("key", "value")' sets a global variable.
- 'pm.request.headers.add({key: "X-My-Header", value: "HeaderValue"})' adds a header.
- Use built-in libraries like 'crypto-js'. For example: 'const hash = CryptoJS.HmacSHA256("Message", "Secret Passphrase");'
Respond ONLY with the raw JavaScript code block. Do not include markdown fences like \`\`\`javascript.`;
  }
  return `You are an expert JavaScript developer writing test scripts for an API client.
The script runs in a sandbox with a 'pm' object available.
- 'const response = pm.response.json()' gets the JSON body.
- 'pm.test("Test Name", () => { pm.expect(value).to.eql(expected); })' defines a test.
- Common assertions: '.to.eql()', '.to.have.property()', '.to.be.a()', '.to.include()'.
- 'pm.response.to.have.status(200)' checks the status code.
- 'pm.response.to.have.header("Content-Type")' checks for a header.
Respond ONLY with the raw JavaScript code block. Do not include markdown fences like \`\`\`javascript.`;
};

export const AiScriptGeneratorModal: React.FC<AiScriptGeneratorModalProps> = ({ show, onClose, onGenerate, type }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();
  const apiKey = useApiKey();

  const handleGenerate = async () => {
    if (!apiKey) {
      addToast('Gemini API key is not set. Add it in Settings.', 'error');
      return;
    }
    if (!prompt.trim()) {
      addToast('Please enter a description of the script to generate.', 'info');
      return;
    }
    setIsLoading(true);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: getSystemInstruction(type),
        },
      });
      const generatedScript = (response.text ?? '').trim();
      onGenerate(generatedScript);
      onClose();
      addToast('AI script generated successfully!', 'success');
    } catch (error: any) {
      console.error('AI script generation failed:', error);
      if (error instanceof TypeError && error.message.includes('dynamically imported module')) {
        addToast('Failed to load AI module. Please check your network connection.', 'error');
      } else {
        addToast('Failed to generate script. Please check your API key and try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <div className="flex justify-between items-center pb-3 border-b border-border">
        <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-400" />
            AI Script Generator ({type === 'test' ? 'Tests' : 'Pre-request'})
        </h2>
        <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">&times;</button>
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Describe what you want to achieve:</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`e.g., "Check if the response status is 200 and the 'user.id' property exists"`}
            className="w-full h-24 p-2 bg-input border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate} isLoading={isLoading} disabled={!apiKey || isLoading}>
            {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </div>
      </div>
    </Modal>
  );
};