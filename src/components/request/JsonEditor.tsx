import React from 'react';
import { CodeEditor } from '../ui/CodeEditor';
import { AlertTriangle } from '../icons';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange: (isInvalid: boolean) => void;
  placeholder?: string;
  'aria-label'?: string;
  minHeight?: number;
}

/** JSON editor with live validation. `{{variables}}` are allowed anywhere, quoted or not. */
export const JsonEditor: React.FC<JsonEditorProps> = ({ value, onChange, onValidationChange, placeholder, minHeight, ...rest }) => {
  const [error, setError] = React.useState<string | null>(null);
  const showError = !!error && !!value.trim();

  React.useEffect(() => {
    onValidationChange(showError);
  }, [showError, onValidationChange]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={value}
          onChange={onChange}
          language="json"
          onError={setError}
          placeholder={placeholder ?? '{\n  "name": "{{name}}"\n}'}
          aria-label={rest['aria-label'] ?? 'JSON body'}
          minHeight={minHeight}
        />
      </div>
      {showError && (
        <div role="alert" className="flex flex-shrink-0 items-start gap-2 border-t border-destructive/30 bg-destructive-bg px-3 py-1.5 font-mono text-xs text-destructive-text">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}
    </div>
  );
};
