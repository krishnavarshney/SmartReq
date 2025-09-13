import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { KeyValueItem } from '../../types';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './HoverCard'; // Keep imports for now, might remove HoverCard later
import { useLog } from '../../context/LogContext';
import { Copy, ExternalLink, Link as LinkIcon, X } from '../icons';

interface VariablePreviewInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  url: string;
  onUrlChange: (url: string) => void;
  globals: KeyValueItem[];
  dataVariables?: Record<string, string>;
}

export const VariablePreviewInput: React.FC<VariablePreviewInputProps> = ({ url, onUrlChange, globals, dataVariables, placeholder, className, ...props }) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const variableSuggestionsRef = useRef<HTMLDivElement>(null);
  const { urlHistory } = useLog();
  
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const [isVariableSuggestionsOpen, setIsVariableSuggestionsOpen] = useState(false);
  const [variableSuggestions, setVariableSuggestions] = useState<string[]>([]);
  const [activeVariableSuggestionIndex, setActiveVariableSuggestionIndex] = useState(0);
  const [variableQuery, setVariableQuery] = useState('');

  // State to hold the current plain text content of the editable div
  const [currentTextContent, setCurrentTextContent] = useState(url);
  const [isFocused, setIsFocused] = useState(false);

  // Ref to store the selection range before re-render
  const savedSelectionStart = useRef<number | null>(null);
  const savedSelectionEnd = useRef<number | null>(null);

  const variableMap = useMemo(() => {
    const combinedMap: Record<string, { value: string, type: string }> = {};
    globals.filter(g => g.enabled && g.key).forEach(g => {
      combinedMap[g.key] = { value: g.value, type: 'Global' };
    });
    Object.entries(dataVariables || {}).forEach(([key, value]) => {
      combinedMap[key] = { value: String(value), type: 'Data Source' };
    });
    return combinedMap;
  }, [globals, dataVariables]);

  const generateHighlightedHtml = useCallback((text: string) => {
    const regex = /\{\{(.+?)\}\}/g;
    let lastIndex = 0;
    let html = '';
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        html += text.slice(lastIndex, match.index);
      }
      const varName = match[1].trim();
      const varDetails = variableMap[varName];
      const hoverContent = varDetails ? `${varDetails.type}: ${varDetails.value}` : 'Unresolved variable';
      let pillClasses = "var-token rounded-sm mx-px pointer-events-auto cursor-help";
      if (varDetails?.type === 'Global') pillClasses += " text-blue-400 bg-blue-400/10";
      else if (varDetails?.type === 'Data Source') pillClasses += " text-orange-400 bg-orange-400/10";
      else pillClasses += " text-red-400 bg-red-400/10";

      html += `<span contenteditable="false" class="${pillClasses}" title="${hoverContent}" data-tooltip="${hoverContent}">${`{{${varName}}}`}</span>`;
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      html += text.slice(lastIndex);
    }
    return html;
  }, [variableMap]);

  useEffect(() => {
    if (url !== currentTextContent) {
      setCurrentTextContent(url);
    }
  }, [url, currentTextContent]);

  const getCharacterOffset = useCallback((rootNode: Node, range: Range) => {
    let offset = 0;
    const walker = document.createTreeWalker(
      rootNode,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null
    );

    let currentNode;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === range.endContainer) {
        offset += range.endOffset;
        break;
      }
      if (currentNode.nodeType === Node.TEXT_NODE) {
        offset += currentNode.textContent?.length || 0;
      } else if (currentNode.nodeType === Node.ELEMENT_NODE && (currentNode as HTMLElement).contentEditable === 'false') {
        offset += currentNode.textContent?.length || 0;
      }
    }
    return offset;
  }, []);

  // Restore cursor after re-render
  useEffect(() => {
    if (!contentEditableRef.current || savedSelectionStart.current === null || savedSelectionEnd.current === null) return;

    const selection = window.getSelection();
    if (!selection) return;

    const restore = () => {
      try {
        const range = document.createRange();
        let charCount = 0;
        let startNode: Node | null = null;
        let endNode: Node | null = null;
        let startOffset = 0;
        let endOffset = 0;

        const childNodes = contentEditableRef.current!.childNodes;

        for (let i = 0; i < childNodes.length; i++) {
          const node = childNodes[i];

          if (node.nodeType === Node.TEXT_NODE) {
            const nodeLength = node.textContent?.length || 0;

            if (startNode === null && savedSelectionStart.current! <= charCount + nodeLength) {
              startNode = node;
              startOffset = savedSelectionStart.current! - charCount;
            }
            if (endNode === null && savedSelectionEnd.current! <= charCount + nodeLength) {
              endNode = node;
              endOffset = savedSelectionEnd.current! - charCount;
            }
            charCount += nodeLength;
          } else if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).contentEditable === 'false') {
            const varTextLength = node.textContent?.length || 0;

            if (startNode === null && savedSelectionStart.current! <= charCount + varTextLength) {
              startNode = contentEditableRef.current!;
              startOffset = i + 1; // place caret after the token
            }
            if (endNode === null && savedSelectionEnd.current! <= charCount + varTextLength) {
              endNode = contentEditableRef.current!;
              endOffset = i + 1;
            }
            charCount += varTextLength;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const innerTextLength = node.textContent?.length || 0;
            if (startNode === null && savedSelectionStart.current! <= charCount + innerTextLength) {
              startNode = node;
              startOffset = savedSelectionStart.current! - charCount;
            }
            if (endNode === null && savedSelectionEnd.current! <= charCount + innerTextLength) {
              endNode = node;
              endOffset = savedSelectionEnd.current! - charCount;
            }
            charCount += innerTextLength;
          }
        }

        if (startNode && endNode) {
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          const range = document.createRange();
          range.selectNodeContents(contentEditableRef.current!);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (e) {
        const range = document.createRange();
        range.selectNodeContents(contentEditableRef.current!);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      } finally {
        savedSelectionStart.current = null;
        savedSelectionEnd.current = null;
      }
    };

    setTimeout(restore, 0);
  }, [currentTextContent, getCharacterOffset]);

  const openVariableSuggestionsForText = useCallback((text: string, cursorPosition: number) => {
    const before = text.slice(0, cursorPosition);
    const openIdx = before.lastIndexOf('{{');
    const closeIdx = before.lastIndexOf('}}');
    if (openIdx !== -1 && (closeIdx === -1 || closeIdx < openIdx)) {
      const query = before.slice(openIdx + 2); // after '{{'
      setVariableQuery(query);
      const filtered = Object.keys(variableMap).filter(v => v.toLowerCase().includes(query.toLowerCase()));
      setVariableSuggestions(filtered);
      setActiveVariableSuggestionIndex(0);
      setIsVariableSuggestionsOpen(filtered.length > 0);
      return;
    }
    setIsVariableSuggestionsOpen(false);
  }, [variableMap]);

  const handleInput = useCallback(() => {
    if (!contentEditableRef.current) return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      savedSelectionStart.current = getCharacterOffset(contentEditableRef.current, range.cloneRange());
      savedSelectionEnd.current = getCharacterOffset(contentEditableRef.current, range);
    } else {
      savedSelectionStart.current = null;
      savedSelectionEnd.current = null;
    }

    const newPlainText = contentEditableRef.current.innerText;
    setCurrentTextContent(newPlainText);
    onUrlChange(newPlainText);

    if (savedSelectionStart.current !== null) {
      openVariableSuggestionsForText(newPlainText, savedSelectionStart.current);
    }
  }, [onUrlChange, getCharacterOffset, openVariableSuggestionsForText]);

  const handleVariableSuggestionClick = useCallback((variableName: string) => {
    if (!contentEditableRef.current) return;

    const currentText = currentTextContent;
    // Prefer saved caret pos; if null, fall back to end
    const caret = savedSelectionStart.current ?? currentText.length;

    const before = currentText.slice(0, caret);
    const after = currentText.slice(caret);

    const openIdx = before.lastIndexOf('{{');
    const closeIdx = before.lastIndexOf('}}');

    if (openIdx !== -1 && (closeIdx === -1 || closeIdx < openIdx)) {
      const prefix = before.slice(0, openIdx);
      const newText = `${prefix}{{${variableName}}}${after}`;
      setCurrentTextContent(newText);
      onUrlChange(newText);

      const newCursorPos = (prefix + `{{${variableName}}}`).length;
      savedSelectionStart.current = newCursorPos;
      savedSelectionEnd.current = newCursorPos;
    }
    setIsVariableSuggestionsOpen(false);

    // Refocus contenteditable to ensure it remains editable after inserting token
    requestAnimationFrame(() => {
      contentEditableRef.current?.focus();
      const selection = window.getSelection();
      if (selection && contentEditableRef.current) {
        const range = document.createRange();
        range.selectNodeContents(contentEditableRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });
  }, [onUrlChange, currentTextContent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isVariableSuggestionsOpen && variableSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveVariableSuggestionIndex(prev => (prev + 1) % variableSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveVariableSuggestionIndex(prev => (prev - 1 + variableSuggestions.length) % variableSuggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleVariableSuggestionClick(variableSuggestions[activeVariableSuggestionIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsVariableSuggestionsOpen(false);
      }
    } else if (isSuggestionsOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        if (activeSuggestionIndex > -1) {
          e.preventDefault();
          onUrlChange(suggestions[activeSuggestionIndex]);
          setIsSuggestionsOpen(false);
        }
      }
    }
    if (e.key === 'Escape') {
      setIsSuggestionsOpen(false);
      setIsVariableSuggestionsOpen(false);
    }
  }, [isSuggestionsOpen, suggestions, activeSuggestionIndex, onUrlChange, isVariableSuggestionsOpen, variableSuggestions, activeVariableSuggestionIndex, handleVariableSuggestionClick]);

  const handleFocus = useCallback(() => { setIsSuggestionsOpen(true); setIsFocused(true); }, []);
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setIsSuggestionsOpen(false);
      setIsVariableSuggestionsOpen(false);
      setIsFocused(false);
    }, 150);
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    onUrlChange(suggestion);
    setIsSuggestionsOpen(false);
  }, [onUrlChange]);

  useEffect(() => {
    if (url && isSuggestionsOpen) {
      const filtered = urlHistory
        .filter(historyUrl => historyUrl.toLowerCase().includes(url.toLowerCase()) && historyUrl !== url)
        .slice(0, 10);
      setSuggestions(filtered);
      setActiveSuggestionIndex(-1);
    } else {
      setSuggestions([]);
    }
  }, [url, urlHistory, isSuggestionsOpen]);

  useEffect(() => {
    const ref = isVariableSuggestionsOpen ? variableSuggestionsRef : suggestionsRef;
    const activeIndex = isVariableSuggestionsOpen ? activeVariableSuggestionIndex : activeSuggestionIndex;
    if (activeIndex > -1 && ref.current) {
        const activeElement = ref.current.children[activeIndex] as HTMLElement;
        if (activeElement) {
            activeElement.scrollIntoView({ block: 'nearest' });
        }
    }
  }, [activeSuggestionIndex, activeVariableSuggestionIndex, isVariableSuggestionsOpen]);

  const parsed = useMemo(() => {
    const raw = currentTextContent.trim();
    if (!raw) return { valid: false, host: '', path: '', queryCount: 0, scheme: '' };
    try {
      const withProto = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
      const u = new URL(withProto);
      const queryCount = Array.from(u.searchParams.keys()).length;
      return { valid: true, host: u.host, path: u.pathname, queryCount, scheme: u.protocol.replace(':','') };
    } catch {
      return { valid: false, host: '', path: '', queryCount: 0, scheme: '' };
    }
  }, [currentTextContent]);

  const clearUrl = () => {
    setCurrentTextContent('');
    onUrlChange('');
    contentEditableRef.current?.focus();
  };

  const copyUrl = () => {
    if (!currentTextContent) return;
    navigator.clipboard.writeText(currentTextContent);
  };

  const openUrl = () => {
    if (!parsed.valid) return;
    const withProto = /^https?:\/\//i.test(currentTextContent) ? currentTextContent : `http://${currentTextContent}`;
    window.open(withProto, '_blank');
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={contentEditableRef}
        contentEditable="true"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`w-full glass-surface-lite elev-1 border rounded-md text-base sm:text-[15px] text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none overflow-auto whitespace-nowrap pr-24 ${parsed.valid ? 'border-border' : 'border-destructive'}`}
        style={{ minWidth: '0' }}
        role="textbox"
        aria-multiline={false}
        spellCheck={false}
        {...props}
        dangerouslySetInnerHTML={{ __html: generateHighlightedHtml(currentTextContent) }}
      />
      {/* Right-side quick actions */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-transparent">
        {currentTextContent && (
          <button aria-label="Clear URL" onClick={clearUrl} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
        <button aria-label="Copy URL" onClick={copyUrl} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
          <Copy className="h-4 w-4" />
        </button>
        <button aria-label="Open in new tab" onClick={openUrl} disabled={!parsed.valid} className={`p-1 rounded hover:bg-accent ${parsed.valid ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/40 cursor-not-allowed'}`}>
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
      {(currentTextContent === '' || currentTextContent.length === 0) && placeholder && (
        <div className="absolute inset-0 pointer-events-none sm:text-base text-muted-foreground flex items-center">
          {placeholder}
        </div>
      )}
      {/* Helper bar (positioned below input, non-overlapping) */}
      {(isFocused || !!currentTextContent) && (
        <div className="absolute left-0 top-[calc(100%+4px)] w-full text-xs flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded glass-surface-lite elev-1 max-w-[70%] overflow-hidden">
            <span className={`inline-flex items-center gap-1 ${parsed.scheme === 'https' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              <LinkIcon className="h-3.5 w-3.5" />
              {parsed.scheme || 'url'}
            </span>
            {parsed.host && (
              <span className="inline-flex items-center gap-1 text-foreground">
                <img src={`https://www.google.com/s2/favicons?domain=${parsed.host}&sz=16`} alt="" className="h-3.5 w-3.5 rounded-sm" />
                <span className="truncate max-w-[160px]">{parsed.host}</span>
              </span>
            )}
            {parsed.path && <span className="text-muted-foreground truncate">{parsed.path}</span>}
          </div>
          <div className="text-muted-foreground">{parsed.queryCount > 0 ? `${parsed.queryCount} param${parsed.queryCount>1?'s':''}` : 'no params'}</div>
        </div>
      )}
      {isVariableSuggestionsOpen && variableSuggestions.length > 0 && (
        <div ref={variableSuggestionsRef} className="autocomplete-suggestions absolute top-full mt-2 w-full bg-popover border border-border rounded-md shadow-lg z-20 p-1 max-h-60 overflow-y-auto animate-scale-in">
            {variableSuggestions.map((varName, index) => (
                <button
                    key={varName}
                    onClick={() => handleVariableSuggestionClick(varName)}
                    onMouseDown={e => e.preventDefault()}
                    className={`w-full text-left flex items-center justify-between rounded-sm px-2 py-1.5 outline-none cursor-pointer hover:bg-accent ${activeVariableSuggestionIndex === index ? 'bg-accent' : ''}`}
                >
                    <span className="font-mono">{varName}</span>
                    <span className="text-xs text-muted-foreground">{variableMap[varName]?.type}</span>
                </button>
            ))}
        </div>
      )}
      {isSuggestionsOpen && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="autocomplete-suggestions absolute top-full mt-2 w-full bg-popover border border-border rounded-md shadow-lg z-20 p-1 max-h-60 overflow-y-auto animate-scale-in">
            {suggestions.map((suggestion, index) => (
                <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseDown={e => e.preventDefault()}
                    className={`w-full text-left flex items-center rounded-sm px-2 py-1.5 outline-none cursor-pointer hover:bg-accent ${activeSuggestionIndex === index ? 'bg-accent' : ''}`}
                >
                    <span className="truncate font-mono">{suggestion}</span>
                </button>
            ))}
        </div>
      )}
    </div>
  );
};