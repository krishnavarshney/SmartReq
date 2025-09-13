import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Sparkles, AlertTriangle } from '../icons';
import { useToast } from '../../context/ToastContext';

interface AiResponseInsightsModalProps {
  show: boolean;
  onClose: () => void;
  responseBody: string;
}

const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const simpleMarkdownToHtml = (text: string) => {
    if (!text) return '';
    return escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded-sm font-mono">$1</code>')
        .replace(/\n/g, '<br />');
};

export const AiResponseInsightsModal: React.FC<AiResponseInsightsModalProps> = ({ show, onClose, responseBody }) => {
  const [insights, setInsights] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (!show) return;

    const generateInsights = async () => {
      setIsLoading(true);
      setError(null);

      if (!process.env.API_KEY) {
        setError("Gemini API key is not available in the execution environment.");
        setIsLoading(false);
        return;
      }
      
      try {
        const { GoogleGenAI } = await import('@google/genai');
        let parsedBody = responseBody;
        try {
            // Attempt to parse and re-stringify to ensure it's valid JSON
            parsedBody = JSON.stringify(JSON.parse(responseBody), null, 2);
        } catch (e) {
            setError("The response body is not valid JSON. AI insights are only available for JSON responses.");
            setIsLoading(false);
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the following JSON API response and provide a concise summary for a developer. Highlight the main entities, mention the count of items in any arrays, and point out any potential issues like empty arrays, null values, or unexpected data types. Format the output using markdown.\n\nJSON Response:\n\`\`\`json\n${parsedBody}\n\`\`\``
        });

        setInsights(response.text);
      } catch (err: any) {
        console.error('AI insights generation failed:', err);
        if (err instanceof TypeError && err.message.includes('dynamically imported module')) {
            setError('Failed to load AI module. Please check your network connection and reload.');
        } else {
            setError('Failed to generate insights. Please check your API key and try again.');
        }
        addToast('Failed to generate insights.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    generateInsights();
  }, [show, responseBody, addToast]);

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <div className="flex justify-between items-center pb-3 border-b border-border">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-400" />
          AI Response Insights
        </h2>
        <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">&times;</button>
      </div>
      <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-48 space-y-2">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            <p className="text-muted-foreground">Analyzing response...</p>
          </div>
        )}
        {error && (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-center text-destructive-text p-4 bg-destructive-bg rounded-lg">
                <AlertTriangle className="h-8 w-8" />
                <p className="font-semibold">Analysis Error</p>
                <p className="text-sm">{error}</p>
            </div>
        )}
        {!isLoading && !error && (
          <div className="prose prose-sm prose-invert max-w-none prose-strong:text-foreground prose-em:text-muted-foreground" dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(insights) }} />
        )}
      </div>
       <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
    </Modal>
  );
};