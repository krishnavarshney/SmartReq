import React from 'react';
import { BodyDetails, BodyType } from '../../types';
import { JsonEditor } from './JsonEditor';
import { KeyValueEditor } from '../ui/KeyValueEditor';
import { EmptyState } from '../ui/EmptyState';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';
import { Wand2 } from '../icons';
import { useToast } from '../../context/ToastContext';

interface BodyBuilderProps {
  body: BodyDetails;
  onBodyChange: (body: BodyDetails) => void;
  onValidationChange: (isInvalid: boolean) => void;
}

const BODY_TYPES: { value: BodyType, label: string }[] = [
    { value: 'none', label: 'None'},
    { value: 'json', label: 'JSON'},
    { value: 'form-data', label: 'Form-Data'},
    { value: 'x-www-form-urlencoded', label: 'URL-Encoded'},
    { value: 'graphql', label: 'GraphQL'},
];

export const BodyBuilder: React.FC<BodyBuilderProps> = ({ body, onBodyChange, onValidationChange }) => {
  const { addToast } = useToast();

  const handleTypeChange = (type: BodyType) => {
    onBodyChange({ ...body, type });
    if (type !== 'json') {
      onValidationChange(false);
    }
  };
  
  const handlePrettify = () => {
    if (body.type === 'json' && body.jsonBody) {
      try {
        const parsed = JSON.parse(body.jsonBody);
        const prettified = JSON.stringify(parsed, null, 2);
        onBodyChange({ ...body, jsonBody: prettified });
        addToast('JSON formatted successfully!', 'success');
      } catch (error) {
        addToast('Invalid JSON, cannot format.', 'error');
      }
    }
  };

  const renderBodyEditor = () => {
    switch(body.type) {
      case 'json':
        return (
          <JsonEditor 
            value={body.jsonBody || ''}
            onChange={jsonBody => onBodyChange({ ...body, jsonBody })}
            onValidationChange={onValidationChange}
          />
        );
      case 'graphql':
        return (
          <div className="p-4 space-y-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Query</div>
              <textarea
                className="w-full h-40 font-mono text-sm p-3 rounded-md bg-muted border border-border focus:outline-none"
                placeholder={"query Example($id: ID!){\n  user(id: $id){\n    id\n    name\n  }\n}"}
                value={body.graphqlQuery || ''}
                onChange={(e) => onBodyChange({ ...body, graphqlQuery: e.target.value })}
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Variables (JSON)</div>
              <JsonEditor
                value={body.graphqlVariables || ''}
                onChange={(v) => onBodyChange({ ...body, graphqlVariables: v })}
                onValidationChange={onValidationChange}
              />
            </div>
          </div>
        );
      case 'form-data':
        return (
          <div className="p-4">
            <KeyValueEditor 
              items={body.formData || [{id: Date.now(), key: '', value: '', enabled: true}]}
              onItemsChange={formData => onBodyChange({ ...body, formData })}
              showBulkEdit={true}
            />
          </div>
        );
      case 'x-www-form-urlencoded':
        return (
          <div className="p-4">
            <KeyValueEditor 
              items={body.urlEncoded || [{id: Date.now(), key: '', value: '', enabled: true}]}
              onItemsChange={urlEncoded => onBodyChange({ ...body, urlEncoded })}
              showBulkEdit={true}
            />
          </div>
        );
      case 'none':
      default:
        return <EmptyState message="This request does not have a body." />;
    }
  }

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="flex items-center justify-between gap-4 p-2 border-b border-border">
        <SegmentedControl
            options={BODY_TYPES}
            value={body.type}
            onChange={(value) => handleTypeChange(value as BodyType)}
        />
        {body.type === 'json' && (
          <Button variant="secondary" size="sm" onClick={handlePrettify} disabled={!body.jsonBody?.trim()}>
            <Wand2 className="h-4 w-4 mr-2" />
            Prettify
          </Button>
        )}
      </div>
      <div className="flex-grow overflow-auto">
        {renderBodyEditor()}
      </div>
    </div>
  );
};
