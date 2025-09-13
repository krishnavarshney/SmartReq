import React from 'react';
import { CodeEditor } from './ui/CodeEditor';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange: (isInvalid: boolean) => void;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({ value, onChange, onValidationChange }) => {
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // If there is content and it's not just whitespace, validation depends on the error state.
    // If there is no content, it's considered valid.
    const isInvalid = value.trim() ? !!error : false;
    onValidationChange(isInvalid);
  }, [error, onValidationChange, value]);

  return (
    <div className="flex flex-col h-full relative">
      <CodeEditor 
        value={value}
        onChange={onChange}
        language="json"
        onError={setError}
      />
      {error && value.trim() && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-destructive/20 text-destructive text-xs font-mono border-t border-destructive/30 animate-fade-in">
          <strong>Invalid JSON:</strong> {error}
        </div>
      )}
    </div>
  );
};
