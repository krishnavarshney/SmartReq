import React from 'react';

interface HtmlPreviewProps {
    html: string;
}

export const HtmlPreview: React.FC<HtmlPreviewProps> = ({ html }) => {
    return (
        <iframe
            srcDoc={html}
            title="HTML Preview"
            sandbox="" // Most restrictive sandbox for security
            className="w-full h-full border-0 bg-white"
        />
    );
};
