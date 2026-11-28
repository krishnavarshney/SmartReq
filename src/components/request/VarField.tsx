import React from 'react';
import { KeyValueItem } from '../../types';
import { VariablePreviewInput } from '../ui/VariablePreviewInput';

interface VarFieldProps {
  value: string;
  onChange: (value: string) => void;
  variables: KeyValueItem[];
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/** A form-sized text field with `{{variable}}` highlighting and autocomplete. */
export const VarField: React.FC<VarFieldProps> = ({ value, onChange, variables, placeholder, id, className = '', ...rest }) => (
  <div
    className={`h-8 w-full min-w-0 rounded-md border border-input bg-background transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 ${className}`}
  >
    <VariablePreviewInput
      id={id}
      url={value}
      onUrlChange={onChange}
      globals={variables}
      showHistory={false}
      placeholder={placeholder}
      aria-label={rest['aria-label']}
      className="h-full"
      inputClassName="!text-xs"
    />
  </div>
);
