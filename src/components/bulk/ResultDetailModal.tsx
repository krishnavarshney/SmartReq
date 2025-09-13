import React from 'react';
import { Modal } from '../ui/Modal';
import { BulkResult, SingleRequestLog } from '../../types';
import { ResponsePanel } from '../response/ResponsePanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { RawTextView } from '../response/RawTextView';

interface ResultDetailModalProps {
    result: BulkResult;
    onClose: () => void;
}

export const ResultDetailModal: React.FC<ResultDetailModalProps> = ({ result, onClose }) => {
    
    const logEntry: SingleRequestLog = {
        id: result.id,
        mode: 'single',
        request: result.request,
        response: result.response,
        timestamp: new Date().toISOString(),
        originalRequest: {} as any, // Not needed for this view
    };

    const renderRequestBody = () => {
        const { request } = result;

        if (request.bodyStructure) {
            return (
                <div className="font-mono text-sm space-y-1 p-4">
                    {request.bodyStructure
                        .filter(item => item.enabled && item.key)
                        .map((item, index) => (
                            <div key={index} className="flex items-start">
                                <span className="text-sky-400 mr-2 flex-shrink-0">{item.key}:</span>
                                <span className="text-amber-400 break-all">{item.value}</span>
                            </div>
                        ))
                    }
                </div>
            );
        }
        
        if (typeof request.body === 'string') {
            return <RawTextView text={request.body} searchTerm="" wordWrap={true} isRegex={false} activeMatchIndex={-1} onSearchResults={() => {}} />;
        }
        
        return <RawTextView text="No request body, or body is not displayable as text (e.g., multipart/form-data)." searchTerm="" wordWrap={true} isRegex={false} activeMatchIndex={-1} onSearchResults={() => {}} />;
    };

    return (
        <Modal show={true} onClose={onClose} size="3xl">
            <div className="flex justify-between items-center pb-3 border-b border-border">
                <h2 className="text-lg font-bold">Iteration #{result.id} Details</h2>
                <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">&times;</button>
            </div>
            <div className="mt-4 h-[70vh] flex flex-col gap-4">
                <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card">
                     <ResponsePanel currentLog={logEntry} isLoading={false} responseHistory={[]} onGenerateTests={() => {}} isGeneratingTests={false} />
                </div>
                <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card">
                     <Tabs defaultValue="request-body" className="h-full">
                        <div className="flex items-center justify-between border-b border-border p-2">
                             <TabsList>
                                <TabsTrigger value="request-body">Request Body</TabsTrigger>
                                <TabsTrigger value="request-headers">Request Headers</TabsTrigger>
                                <TabsTrigger value="source-data">Source Data</TabsTrigger>
                            </TabsList>
                        </div>
                         <div className="overflow-auto flex-grow">
                             <TabsContent value="request-body">
                                {renderRequestBody()}
                            </TabsContent>
                             <TabsContent value="request-headers">
                                <div className="font-mono text-sm space-y-1 p-4">
                                    {result.request.headers.filter(h => h.enabled).map((header, i) => (
                                        <div key={i} className="flex items-start">
                                            <span className="text-sky-400 mr-2 flex-shrink-0">{header.key}:</span>
                                            <span className="text-amber-400 break-all">{header.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                             <TabsContent value="source-data">
                                 <div className="font-mono text-sm space-y-1 p-4">
                                    {Object.entries(result.data).map(([key, value]) => (
                                        <div key={key} className="flex items-start">
                                            <span className="text-sky-400 mr-2 flex-shrink-0">{key}:</span>
                                            <span className="text-amber-400 break-all">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        </div>
                     </Tabs>
                </div>
            </div>
        </Modal>
    );
};