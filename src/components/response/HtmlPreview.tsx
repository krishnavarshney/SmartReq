import React, { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';

interface HtmlPreviewProps {
    html: string;
    /** Request URL, used as <base href> so relative images and stylesheets resolve. */
    baseUrl?: string;
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const withBase = (html: string, baseUrl?: string) => {
    if (!baseUrl || /<base\s/i.test(html)) return html;
    try {
        new URL(baseUrl);
    } catch {
        return html;
    }
    const tag = `<base href="${escapeAttr(baseUrl)}">`;
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
    return tag + html;
};

/**
 * Renders HTML in a fully sandboxed iframe: no scripts, forms, popups or
 * same-origin access. Static resources (images, CSS) still load.
 */
export const HtmlPreview: React.FC<HtmlPreviewProps> = ({ html, baseUrl }) => {
    const doc = useMemo(() => withBase(html, baseUrl), [html, baseUrl]);
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-7 flex-shrink-0 items-center gap-1.5 border-b border-border bg-muted/40 px-3 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Sandboxed preview. Scripts, forms and popups are disabled.
            </div>
            <iframe
                srcDoc={doc}
                title="HTML preview"
                sandbox=""
                referrerPolicy="no-referrer"
                className="min-h-0 w-full flex-1 border-0 bg-white"
            />
        </div>
    );
};
