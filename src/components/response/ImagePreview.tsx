import React, { useState } from 'react';
import { formatBytes } from '../../utils/formatters';

interface ImagePreviewProps {
    src: string;
    contentType: string;
    size?: number;
}

/** Image response viewer on a checkerboard so transparency is visible. */
export const ImagePreview: React.FC<ImagePreviewProps> = ({ src, contentType, size }) => {
    const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
    const [failed, setFailed] = useState(false);
    const mime = contentType.split(';')[0].trim();
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6"
                style={{
                    backgroundColor: 'hsl(var(--muted))',
                    backgroundImage:
                        'linear-gradient(45deg, hsl(var(--border)) 25%, transparent 25%), linear-gradient(-45deg, hsl(var(--border)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(var(--border)) 75%), linear-gradient(-45deg, transparent 75%, hsl(var(--border)) 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
                }}
            >
                {failed ? (
                    <p className="text-sm text-muted-foreground">The image data could not be decoded.</p>
                ) : (
                    <img
                        src={src}
                        alt="Response image"
                        onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                        onError={() => setFailed(true)}
                        className="max-h-full max-w-full object-contain shadow-sm [image-rendering:auto]"
                        style={dims && dims.w < 64 && dims.h < 64 ? { width: dims.w * 8, imageRendering: 'pixelated' } : undefined}
                    />
                )}
            </div>
            <div className="flex h-7 flex-shrink-0 items-center gap-3 border-t border-border px-3 font-mono text-[11px] tabular-nums text-muted-foreground">
                <span>{mime || 'image'}</span>
                {dims && <span>{dims.w} × {dims.h} px</span>}
                {size ? <span>{formatBytes(size)}</span> : null}
                {dims && dims.w < 64 && dims.h < 64 && <span className="font-sans">Shown at 8× zoom</span>}
            </div>
        </div>
    );
};
