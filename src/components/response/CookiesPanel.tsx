import React from 'react';
import { ResponseCookie } from '../../types';
import { EmptyState } from '../ui/EmptyState';

interface CookiesPanelProps {
    cookies: ResponseCookie[];
}

export const CookiesPanel: React.FC<CookiesPanelProps> = ({ cookies }) => {
    if (cookies.length === 0) {
        return <EmptyState message="No cookies were set in this response." />;
    }
    
    const headers = ['Name', 'Value', 'Domain', 'Path', 'Expires', 'HttpOnly', 'Secure', 'SameSite'];

    return (
         <div className="overflow-auto h-full">
            <table className="w-full text-sm text-left text-muted-foreground">
                <thead className="text-xs text-muted-foreground uppercase bg-muted sticky top-0 z-10">
                    <tr>
                        {headers.map(header => <th key={header} scope="col" className="px-4 py-2 font-semibold">{header}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {cookies.map((cookie) => (
                        <tr key={cookie.name} className="hover:bg-muted">
                            <td className="px-4 py-2 font-medium text-foreground">{cookie.name}</td>
                            <td className="px-4 py-2 max-w-sm break-all">{cookie.value}</td>
                            <td className="px-4 py-2">{cookie.domain || 'N/A'}</td>
                            <td className="px-4 py-2">{cookie.path || 'N/A'}</td>
                            <td className="px-4 py-2">{cookie.expires ? new Date(cookie.expires).toLocaleString() : 'Session'}</td>
                            <td className="px-4 py-2">{String(cookie.httpOnly)}</td>
                            <td className="px-4 py-2">{String(cookie.secure)}</td>
                            <td className="px-4 py-2">{cookie.sameSite || 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};