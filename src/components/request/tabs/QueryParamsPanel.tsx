import React from 'react';
import { KeyValueItem } from '../../../types';
import { KeyValueEditor } from '../../ui/KeyValueEditor';

interface QueryParamsPanelProps {
  params: KeyValueItem[];
  onParamsChange: (params: KeyValueItem[]) => void;
}

export const QueryParamsPanel: React.FC<QueryParamsPanelProps> = ({ params, onParamsChange }) => {
  return (
    <div className="p-4">
      <KeyValueEditor 
        items={params}
        onItemsChange={onParamsChange}
        keyPlaceholder="Key"
        valuePlaceholder="Value"
        showEncodingToggle={true}
        showBulkEdit={true}
      />
    </div>
  );
};