import React, { useMemo, useEffect } from 'react';
import { JsonNode } from '../JsonNode';

interface RawTextViewProps {
  text: string;
  searchTerm: string;
  wordWrap: boolean;
  isRegex?: boolean;
  activeMatchIndex?: number;
  onSearchResults?: (results: { count: number; error: string | null }) => void;
}

const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\\]/g, '\\$&');
};

const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const applyHighlighting = (text: string, searchTerm: string, isRegex: boolean = false, activeMatchIndex: number = -1): { html: string; count: number; error: string | null } => {
  if (!text) return { html: '', count: 0, error: null };
  
  let rawHtml = escapeHtml(text);

  if (!searchTerm) {
    return { html: rawHtml, count: 0, error: null };
  }

  try {
    const pattern = isRegex ? searchTerm : escapeRegExp(searchTerm);
    if (!pattern) return { html: rawHtml, count: 0, error: null };
    
    const searchRegex = new RegExp(`(<[^>]*>)|(${pattern})`, 'gi');
    let matchIndex = 0;
    
    const finalHtml = rawHtml.replace(searchRegex, (match, tag, textToHighlight) => {
        if (tag) return tag;
        if (textToHighlight) {
            const className = matchIndex === activeMatchIndex ? 'active-match' : '';
            matchIndex++;
            return `<mark class="${className}">${textToHighlight}</mark>`;
        }
        return match;
    });

    return { html: finalHtml, count: matchIndex, error: null };

  } catch (e: any) {
    return { html: rawHtml, count: 0, error: `Invalid Regex: ${e.message}` };
  }
};

export const RawTextView: React.FC<RawTextViewProps> = ({
    text,
    searchTerm,
    wordWrap,
    isRegex = false,
    activeMatchIndex = -1,
    onSearchResults
}) => {
    const lines = useMemo(() => text.split('\n'), [text]);
    
    const { html: highlightedContent, count, error } = useMemo(
        () => applyHighlighting(text, searchTerm, isRegex, activeMatchIndex),
        [text, searchTerm, isRegex, activeMatchIndex]
    );

    useEffect(() => {
        onSearchResults?.({ count, error });
    }, [count, error, onSearchResults]);
    
    const preClasses = `
        font-mono text-sm p-4 w-full
        ${wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}
    `;

    let parsedJson: any = null;
    let isJson = false;
    try {
        parsedJson = JSON.parse(text);
        isJson = typeof parsedJson === 'object' && parsedJson !== null;
    } catch (e) {
        // Not valid JSON, render as plain text
    }

    return (
        <div className="flex text-sm font-mono h-full">
            <div className="text-right text-muted-foreground select-none sticky left-0 bg-card pr-4 pl-4 pt-4">
                {lines.map((_, index) => (
                    <div key={index}>{index + 1}</div>
                ))}
            </div>
            {isJson ? (
                <div className={`${preClasses} flex-grow overflow-auto`}>
                    <JsonNode data={parsedJson} startExpanded={true} />
                </div>
            ) : (
                <pre className={`${preClasses} flex-grow overflow-auto`}>
                    <code dangerouslySetInnerHTML={{ __html: highlightedContent }} />
                </pre>
            )}
        </div>
    );
};