import React from 'react';
import { Button, IconButton } from '../ui/Button';
import { Copy, FileJson, Sparkles, TestTube2 } from '../icons';
import { Tooltip } from '../ui/Tooltip';

interface ResponseControlsProps {
    onCopy: () => void;
    onExport: () => void;
    onAiInsights: () => void;
    onGenerateTests: () => void;
    isGeneratingTests: boolean;
}

export const ResponseControls: React.FC<ResponseControlsProps> = ({
    onCopy,
    onExport,
    onAiInsights,
    onGenerateTests,
    isGeneratingTests,
}) => {
    return (
        <div className="flex items-center gap-1">
             <Tooltip content="AI Insights">
                 <IconButton onClick={onAiInsights} size="sm" variant="ghost" aria-label="Open AI insights">
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                </IconButton>
            </Tooltip>
            <Tooltip content="Generate Tests (AI)">
                <Button onClick={onGenerateTests} size="sm" variant="ghost" isLoading={isGeneratingTests} className="w-8 h-8 p-0" aria-label="Generate tests with AI">
                   <TestTube2 className="h-4 w-4 text-primary" />
                </Button>
            </Tooltip>
            <Tooltip content="Copy Response">
                 <IconButton onClick={onCopy} size="sm" variant="ghost" aria-label="Copy response body">
                    <Copy className="h-4 w-4" />
                </IconButton>
            </Tooltip>
            <Tooltip content="Export as JSON">
                <IconButton onClick={onExport} size="sm" variant="ghost" aria-label="Export response as JSON">
                    <FileJson className="h-4 w-4" />
                </IconButton>
            </Tooltip>
        </div>
    );
};
