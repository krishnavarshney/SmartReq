import React from 'react';
import { Cookie } from 'lucide-react';
import { ResponseCookie } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';

interface CookiesPanelProps {
    cookies: ResponseCookie[];
}

/**
 * Browsers never expose Set-Cookie to fetch() (it is a forbidden response
 * header), so an empty list says nothing about what the server sent.
 */
export const CookiesPanel: React.FC<CookiesPanelProps> = ({ cookies }) => {
    if (cookies.length === 0) {
        return (
            <EmptyState
                icon={<Cookie />}
                title="Cookies aren't visible to browser requests"
                message={
                    <>
                        Browsers hide <code className="rounded bg-muted px-1 font-mono text-[12px] text-foreground">Set-Cookie</code> response headers from
                        JavaScript, so SmartReq can't show cookies this response set, even though the browser may have stored them. Check the Network panel in
                        your browser's DevTools to see them.
                    </>
                }
            />
        );
    }

    const cell = 'h-8 whitespace-nowrap border-b border-border/60 px-3 align-middle';
    const head = 'sticky top-0 z-[1] h-8 whitespace-nowrap border-b border-border bg-card px-3 text-left text-[11px] font-medium text-muted-foreground';

    return (
        <div className="h-full min-h-0 overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
                <thead>
                    <tr>
                        {['Name', 'Value', 'Domain', 'Path', 'Expires', 'Flags'].map((h) => (
                            <th key={h} scope="col" className={head}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="font-mono">
                    {cookies.map((cookie) => (
                        <tr key={`${cookie.name}-${cookie.path}-${cookie.domain}`} className="hover:[&>td]:bg-accent/50">
                            <td className={`${cell} text-foreground`}>{cookie.name}</td>
                            <td className={`${cell} max-w-xs truncate text-muted-foreground`} title={cookie.value}>
                                {cookie.value}
                            </td>
                            <td className={`${cell} text-muted-foreground`}>{cookie.domain || '—'}</td>
                            <td className={`${cell} text-muted-foreground`}>{cookie.path || '—'}</td>
                            <td className={`${cell} text-muted-foreground`}>
                                {cookie.expires ? (isNaN(Date.parse(cookie.expires)) ? cookie.expires : new Date(cookie.expires).toLocaleString()) : 'Session'}
                            </td>
                            <td className={`${cell} font-sans`}>
                                <span className="flex gap-1">
                                    {cookie.httpOnly && <Badge>HttpOnly</Badge>}
                                    {cookie.secure && <Badge>Secure</Badge>}
                                    {cookie.sameSite && <Badge>SameSite={cookie.sameSite}</Badge>}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
