import React, { useState, useRef, useEffect } from 'react';

const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const highlightJson = (code: string): string => {
    // Regex explained:
    // 1. ("(?:\\[^]|[^"\\])*")(?=\s*:)  - A string that is a key (followed by a colon). Positive lookahead (?=) doesn't consume the colon.
    // 2. ("(?:\\[^]|[^"\\])*")          - Any other string (a value).
    // 3. \b(true|false)\b             - Booleans.
    // 4. \b(null)\b                   - Null.
    // 5. -?\d+(\.\d+)?([eE][+\-]?\d+)? - Numbers.
    // 6. [{}[\],:]                     - Punctuation.
    const tokenRegex = /("(?:\\[^]|[^"\\])*")(?=\s*:)|("(?:\\[^]|[^"\\])*")|\b(true|false)\b|\b(null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|[{}[\],:]/g;
    
    let lastIndex = 0;
    let result = '';

    code.replace(tokenRegex, (match, key, string, boolean, nullVal, offset) => {
        if (offset > lastIndex) {
            result += escapeHtml(code.substring(lastIndex, offset));
        }

        if (key) {
            result += `<span class="token key">${escapeHtml(key)}</span>`;
        } else if (string) {
            result += `<span class="token string">${escapeHtml(string)}</span>`;
        } else if (boolean) {
            result += `<span class="token boolean">${escapeHtml(boolean)}</span>`;
        } else if (nullVal) {
            result += `<span class="token null">${escapeHtml(nullVal)}</span>`;
        } else if (/^-?\d/.test(match)) {
             result += `<span class="token number">${escapeHtml(match)}</span>`;
        } else {
             result += `<span class="token punctuation">${escapeHtml(match)}</span>`;
        }
        
        lastIndex = offset + match.length;
        return match;
    });

    if (lastIndex < code.length) {
        result += escapeHtml(code.substring(lastIndex));
    }

    return result;
};


const highlightJs = (code: string): string => {
    // A simplified regex for JS highlighting for demonstration
    const tokenRegex = new RegExp(
      '(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)|' + // comments
      '((["\'])(?:\\\\.|(?!\\3)[^\\\\])*\\3)|' +   // strings
      '\\b(function|return|if|else|const|let|var|for|while|async|await|try|catch|new|this|import|export|from|class)\\b|' + // keywords
      '\\b(true|false|null|undefined)\\b|' +    // literals
      '(-?\\d+(?:\\.\\d+)?)' +                   // numbers
      '([{}()\\[\\];,])',                       // punctuation
      'g'
    );
    return escapeHtml(code).replace(tokenRegex, (match, comment, string, _quote, keyword, literal, number, punctuation) => {
      if (comment) return `<span class="token comment">${comment}</span>`;
      if (string) return `<span class="token string">${string}</span>`;
      if (keyword) return `<span class="token keyword">${keyword}</span>`;
      if (literal) return `<span class="token boolean">${literal}</span>`;
      if (number) return `<span class="token number">${number}</span>`;
      if (punctuation) return `<span class="token punctuation">${punctuation}</span>`;
      return match;
    });
};

const highlight = (code: string, language: 'json' | 'javascript') => {
    const highlighter = language === 'json' ? highlightJson : highlightJs;
    return highlighter(code + '\n');
};

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    language: 'json' | 'javascript';
    onError?: (error: string | null) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, language, onError }) => {
    const [lines, setLines] = useState<number[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const lineCount = value.split('\n').length;
        setLines(Array.from({ length: lineCount }, (_, i) => i + 1));
    }, [value]);

    useEffect(() => {
        if (language === 'json' && onError) {
            if (!value.trim()) {
                onError(null);
                return;
            }
            try {
                JSON.parse(value);
                onError(null);
            } catch (e: any) {
                onError(e.message);
            }
        }
    }, [value, language, onError]);

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (preRef.current && gutterRef.current) {
            preRef.current.scrollTop = e.currentTarget.scrollTop;
            preRef.current.scrollLeft = e.currentTarget.scrollLeft;
            gutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    return (
        <div className="relative h-full min-h-[200px] font-mono text-sm bg-muted overflow-hidden">
            <div ref={gutterRef} className="absolute top-0 left-0 h-full p-4 text-right text-muted-foreground select-none overflow-y-hidden">
                {lines.map(line => <div key={line}>{line}</div>)}
            </div>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                className="absolute top-0 left-0 w-full h-full p-4 pl-12 bg-transparent text-transparent caret-foreground border-0 resize-none focus:outline-none whitespace-pre-wrap overflow-auto z-10"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
            />
            <pre ref={preRef} aria-hidden="true" className="absolute top-0 left-0 w-full h-full p-4 pl-12 pointer-events-none whitespace-pre-wrap overflow-auto z-20">
                <code dangerouslySetInnerHTML={{ __html: highlight(value, language) }} />
            </pre>
        </div>
    );
};