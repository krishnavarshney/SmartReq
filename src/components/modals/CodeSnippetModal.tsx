import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { ApiRequest, KeyValueItem } from '../../types';
import HTTPSnippet from 'httpsnippet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { RawTextView } from '../response/RawTextView';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';
import { Copy } from '../icons';
import { buildHarRequest } from '../../utils/har';

interface CodeSnippetModalProps {
    request: ApiRequest;
    onClose: () => void;
    globals: KeyValueItem[];
}

export const CodeSnippetModal: React.FC<CodeSnippetModalProps> = ({ request, onClose, globals }) => {
    const { addToast } = useToast();

    const harRequest = useMemo(() => buildHarRequest(request, globals), [request, globals]);
    const targets = useMemo(() => (HTTPSnippet as any).availableTargets(), []);

    const [selectedTarget, setSelectedTarget] = useState<string>(targets[0]?.key || 'shell');
    const [selectedClient, setSelectedClient] = useState<string>(targets.find((t: any) => t.key === selectedTarget)?.clients[0]?.key || 'curl');

    const code = useMemo(() => {
        try {
            const snippet = new (HTTPSnippet as any)(harRequest);
            const result = snippet.convert(selectedTarget as any, selectedClient);
            return Array.isArray(result) ? result.join('\n\n') : result || '';
        } catch (e) {
            console.error(e);
            return "Error generating snippet.";
        }
    }, [harRequest, selectedTarget, selectedClient]);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            addToast('Code snippet copied!', 'success');
        }, () => {
            addToast('Failed to copy.', 'error');
        });
    };

    return (
        <Modal show={true} onClose={onClose} size="2xl">
            <div className="flex justify-between items-center pb-3 border-b border-border">
                <h2 className="text-lg font-bold">Generate Code Snippet</h2>
                <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">&times;</button>
            </div>
            <div className="mt-4 space-y-4">
                <div className="flex gap-4">
                    <Select value={selectedTarget} onValueChange={key => { setSelectedTarget(key); setSelectedClient(targets.find((t: any) => t.key === key)?.clients[0]?.key || '')}}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {targets.map((target: any) => <SelectItem key={target.key} value={target.key}>{target.title}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {targets.find((t: any) => t.key === selectedTarget)?.clients.map((client: any) => <SelectItem key={client.key} value={client.key}>{client.title}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="relative h-80 overflow-auto bg-muted rounded-lg border border-border">
                     <div className="absolute top-2 right-2 z-10">
                        <Button size="sm" variant="secondary" onClick={handleCopy}>
                           <Copy className="h-4 w-4 mr-2" /> Copy
                        </Button>
                     </div>
                     <RawTextView 
                        text={code} 
                        searchTerm="" 
                        wordWrap={true}
                    />
                </div>
            </div>
        </Modal>
    );
};