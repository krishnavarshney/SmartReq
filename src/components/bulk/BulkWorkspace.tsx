import React, { useState } from 'react';
import { Resizable } from 're-resizable';
import { VerticalResizableHandle } from '../ui/VerticalResizableHandle';
import { ApiRequest, BulkResult, BulkRunState, BulkSettings, KeyValueItem } from '../../types';
import { RequestComposer } from '../request/RequestComposer';
import { RequestPanel } from '../request/RequestPanel';
import { DataInputPanel } from './DataInputPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { HorizontalResizableHandle } from '../ui/HorizontalResizableHandle';

interface BulkWorkspaceProps {
    request: ApiRequest;
    onRequestChange: (request: ApiRequest) => void;
    data: Record<string, string>[];
    onDataChange: (data: Record<string, string>[]) => void;
    results: BulkResult[];
    runState: BulkRunState;
    onRun: () => void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    onTestSend: () => void;
    isTestSending?: boolean;
    settings: BulkSettings;
    onSettingsChange: (settings: BulkSettings) => void;
    onGenerateBulkData: (data: Record<string, any>[]) => void;
    globals: KeyValueItem[];
}

export const BulkWorkspace: React.FC<BulkWorkspaceProps> = (props) => {
    const [isBodyInvalid, setIsBodyInvalid] = useState(false);
    return (
        <div className="flex-grow flex flex-col overflow-hidden gap-4">
            <div className="flex-grow flex overflow-hidden gap-4 flex-row h-[60%]">
                <Resizable
                    className="flex flex-col !overflow-hidden rounded-lg border border-border bg-card"
                    defaultSize={{ width: '40%', height: '100%' }}
                    minWidth={300}
                    maxWidth="70%"
                    enable={{ right: true }}
                    handleComponent={{ right: <VerticalResizableHandle /> }}
                >
                    <DataInputPanel data={props.data} onDataChange={props.onDataChange} />
                </Resizable>
                <div className="flex-grow flex flex-col overflow-hidden rounded-lg border border-border bg-card">
                    <RequestPanel
                        method={props.request.method}
                        onMethodChange={method => props.onRequestChange({ ...props.request, method })}
                        url={props.request.url}
                        onUrlChange={url => props.onRequestChange({ ...props.request, url })}
                        onSend={props.onTestSend}
                        isLoading={!!props.isTestSending}
                        isBodyInvalid={isBodyInvalid}
                        globals={props.globals}
                        sendButtonLabel="Send Test"
                        dataVariables={props.data[0]}
                    />
                    <div className="flex-grow overflow-hidden">
                        <RequestComposer 
                            request={props.request} 
                            onRequestChange={props.onRequestChange} 
                            onBodyValidationChange={setIsBodyInvalid}
                            onGenerateBulkData={props.onGenerateBulkData}
                            onSave={() => {}}
                            data={props.data}
                            globals={props.globals}
                        />
                    </div>
                </div>
            </div>
             <Resizable
                className="flex-shrink-0 !overflow-hidden"
                defaultSize={{ width: '100%', height: '40%' }}
                minHeight={280}
                maxHeight="70%"
                enable={{ top: true }}
                handleComponent={{ top: <HorizontalResizableHandle isTop /> }}
            >
                <div className="h-full w-full">
                     <ExecutionPanel 
                        results={props.results}
                        runState={props.runState}
                        onRun={props.onRun}
                        onPause={props.onPause}
                        onResume={props.onResume}
                        onStop={props.onStop}
                        settings={props.settings}
                        onSettingsChange={props.onSettingsChange}
                        data={props.data}
                     />
                </div>
            </Resizable>
        </div>
    );
};