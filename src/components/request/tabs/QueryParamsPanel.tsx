import React from 'react';
import { KeyValueItem } from '../../../types';
import { KeyValueEditor } from '../../ui/KeyValueEditor';

interface QueryParamsPanelProps {
  params: KeyValueItem[];
  onParamsChange: (params: KeyValueItem[]) => void;
  variables?: KeyValueItem[];
}

export const QueryParamsPanel: React.FC<QueryParamsPanelProps> = ({ params, onParamsChange, variables }) => (
  <div className="space-y-2 p-3">
    <KeyValueEditor
      items={params}
      onItemsChange={onParamsChange}
      keyPlaceholder="Key"
      valuePlaceholder="Value"
      layout="table"
      showEncodingToggle
      showBulkEdit
      variables={variables}
      aria-label="Query parameters"
    />
    <p className="text-xs text-muted-foreground">
      Kept in sync with the URL. Values are URL-encoded when sent; switch off <span className="font-mono text-foreground">%20</span> on a row to send it as typed.
    </p>
  </div>
);
