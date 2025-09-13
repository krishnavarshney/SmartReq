import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { UploadCloud, FileText, Link, Terminal } from '../icons';
import { parseOpenApiSpec } from '../../utils/openapi';
import { Collection, ApiRequest, RequestItem } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useApp } from '../../context/AppContext';
import { parseCurl } from '../../utils/curl';
import { useTabs } from '../../context/TabsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { CodeEditor } from '../ui/CodeEditor';

interface ImportModalProps {
    onImport: (collection: Collection) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onImport }) => {
    const { isImportModalOpen, setIsImportModalOpen } = useApp();
    const { workspace, setWorkspace, addNode } = useWorkspace();
    const [url, setUrl] = useState('');
    const [curl, setCurl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();
    const { openTab } = useTabs();
    
    const handleParseSpec = async (source: string | File) => {
        setIsLoading(true);
        try {
            const collection = await parseOpenApiSpec(source);
            onImport(collection);
            addToast(`Imported "${collection.name}" successfully!`, 'success');
            setIsImportModalOpen(false);
        } catch (error: any) {
            addToast(`Import failed: ${error.message}`, 'error');
            console.error("Import failed", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleParseCurl = () => {
        if (!curl.trim()) {
            addToast('Please paste a cURL command.', 'error');
            return;
        }
        try {
            const partialRequest = parseCurl(curl.trim());
            const newRequest: ApiRequest = {
                method: 'GET',
                url: '',
                queryParams: [],
                headers: [],
                auth: { type: 'none' },
                body: { type: 'none' },
                settings: { sslVerification: true, followRedirects: true },
                ...partialRequest
            };

            const importsCollectionName = 'cURL Imports';
            let importsCollection = workspace.collections.find(c => c.name === importsCollectionName);

            if (!importsCollection) {
                const newCollection: Collection = {
                    id: uuidv4(),
                    type: 'collection',
                    name: importsCollectionName,
                    children: [],
                };
                setWorkspace(ws => ({ ...ws, collections: [...ws.collections, newCollection] }));
                importsCollection = newCollection;
            }

            const newRequestItem: RequestItem = {
                id: uuidv4(),
                type: 'request',
                name: newRequest.url.split('?')[0] || 'cURL Import',
                request: newRequest,
                responses: [],
            };

            addNode(newRequestItem, importsCollection.id);
            openTab(newRequestItem);

            addToast('cURL command imported successfully!', 'success');
            setIsImportModalOpen(false);
            setCurl('');
        } catch (error: any) {
            addToast(`Failed to parse cURL: ${error.message}`, 'error');
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleParseSpec(file);
    };

    return (
        <Modal show={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} size="2xl">
            <div className="flex flex-col h-[60vh]">
                <div className="flex justify-between items-center pb-4 border-b border-border">
                    <h2 className="text-lg font-bold">Import</h2>
                    <button onClick={() => setIsImportModalOpen(false)} className="text-2xl text-muted-foreground hover:text-foreground">&times;</button>
                </div>
                <Tabs defaultValue="curl" className="flex-grow flex flex-col mt-4">
                    <TabsList>
                        <TabsTrigger value="curl"><Terminal className="w-4 h-4 mr-2"/>cURL</TabsTrigger>
                        <TabsTrigger value="url"><Link className="w-4 h-4 mr-2"/>From URL</TabsTrigger>
                        <TabsTrigger value="file"><FileText className="w-4 h-4 mr-2"/>From File</TabsTrigger>
                    </TabsList>
                    <TabsContent value="curl" className="flex-grow flex flex-col mt-4">
                        <div className="flex-grow">
                            <CodeEditor 
                                value={curl} 
                                onChange={setCurl} 
                                language="javascript" 
                            />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button onClick={handleParseCurl} disabled={!curl || isLoading} isLoading={isLoading}>
                                Import cURL
                            </Button>
                        </div>
                    </TabsContent>
                    <TabsContent value="url" className="flex-grow flex flex-col justify-center items-center mt-4">
                        <div className="w-full max-w-md text-center">
                            <Link className="w-16 h-16 mx-auto text-muted-foreground/50 stroke-1"/>
                            <h3 className="text-lg font-semibold mt-4">Import from URL</h3>
                            <p className="text-muted-foreground text-sm mt-1 mb-6">Paste a URL to an OpenAPI/Swagger specification.</p>
                            <div className="flex gap-2">
                                <Input 
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://petstore.swagger.io/v2/swagger.json"
                                />
                                <Button onClick={() => handleParseSpec(url)} disabled={!url || isLoading} isLoading={isLoading}>
                                    Import
                                </Button>
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="file" className="flex-grow flex flex-col justify-center items-center mt-4">
                         <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full border-2 border-border border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground/80" />
                                <p className="mb-2 text-lg text-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag & drop</p>
                                <p className="text-sm text-muted-foreground">OpenAPI/Swagger file (JSON or YAML)</p>
                            </div>
                            <input id="file-upload" type="file" className="hidden" accept=".json, .yaml, .yml" onChange={handleFileChange} />
                        </label>
                    </TabsContent>
                </Tabs>
            </div>
        </Modal>
    );
};