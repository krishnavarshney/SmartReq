import React, { useMemo } from 'react';
import { CodeView, FoldCommand, SearchResults } from './CodeView';
import { buildJsonLines, buildTextLines } from './utils';

interface RawTextViewProps {
  text: string;
  searchTerm: string;
  wordWrap: boolean;
  isRegex?: boolean;
  activeMatchIndex?: number;
  onSearchResults?: (results: SearchResults) => void;
  /** Force plain text even when the text is valid JSON. */
  plain?: boolean;
  foldCommand?: FoldCommand;
}

/**
 * Text viewer with line numbers and search. JSON objects/arrays are pretty
 * printed with folding unless `plain` is set.
 */
export const RawTextView: React.FC<RawTextViewProps> = ({
  text,
  searchTerm,
  wordWrap,
  isRegex = false,
  activeMatchIndex = -1,
  onSearchResults,
  plain = false,
  foldCommand,
}) => {
  const { lines, isJson } = useMemo(() => {
    if (!plain) {
      const t = text.trimStart();
      if (t.startsWith('{') || t.startsWith('[')) {
        try {
          return { lines: buildJsonLines(JSON.parse(text)), isJson: true };
        } catch {
          /* not JSON */
        }
      }
    }
    return { lines: buildTextLines(text), isJson: false };
  }, [text, plain]);

  return (
    <CodeView
      lines={lines}
      wrap={wordWrap}
      foldable={isJson}
      searchTerm={searchTerm}
      isRegex={isRegex}
      activeMatchIndex={activeMatchIndex}
      onSearchResults={onSearchResults}
      foldCommand={foldCommand}
    />
  );
};
