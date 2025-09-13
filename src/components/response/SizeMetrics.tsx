import React from 'react';
import { ApiResponse, FinalApiRequest } from '../../types';
import { formatBytes } from '../../utils/formatters';

interface SizeMetricsProps {
    requestSize?: FinalApiRequest['size'];
    responseSize?: ApiResponse['size'];
}

export const SizeMetrics: React.FC<SizeMetricsProps> = ({ requestSize, responseSize }) => {
    return (
        <div className="p-2 text-sm space-y-3">
            <div>
                <div className="flex justify-between items-center font-bold mb-1">
                    <span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline -mt-0.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                        Response Size
                    </span>
                    <span>{formatBytes(responseSize?.total || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground pl-2">
                    <span>Headers</span>
                    <span>{formatBytes(responseSize?.headers || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground pl-2">
                    <span>Body</span>
                    <span>{formatBytes(responseSize?.body || 0)}</span>
                </div>
            </div>
             <div>
                <div className="flex justify-between items-center font-bold mb-1">
                    <span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline -mt-0.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v17" />
                        </svg>
                        Request Size
                    </span>
                    <span>{formatBytes(requestSize?.total || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground pl-2">
                    <span>Headers</span>
                    <span>{formatBytes(requestSize?.headers || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground pl-2">
                    <span>Body</span>
                    <span>{formatBytes(requestSize?.body || 0)}</span>
                </div>
            </div>
        </div>
    );
};