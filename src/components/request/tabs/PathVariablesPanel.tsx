import React, { useMemo } from 'react';
import { EmptyState } from '../../ui/EmptyState';
import { Link } from '../../icons';
import { KeyValueItem } from '../../../types';

interface PathVariablesPanelProps {
  url: string;
  data: Record<string, string> | undefined;
  globals: KeyValueItem[];
}

export const PathVariablesPanel: React.FC<PathVariablesPanelProps> = ({ url, data, globals }) => {
  console.log('PathVariablesPanel: url =', url);
  console.log('PathVariablesPanel: globals =', globals);

  const variables = useMemo(() => {
    const regex = /\{\{(\w+)\}\}/g;
    const urlPath = url.split('?')[0];
    const matches = urlPath.match(regex) || [];
    const uniqueVariables = [...new Set(matches.map(v => v.replace(/{{|}}/g, '')))];
    console.log('PathVariablesPanel: extracted variables =', uniqueVariables);
    return uniqueVariables;
  }, [url]);

  const globalMap = useMemo(() => {
    const map = globals.reduce((acc, item) => {
        if (item.enabled && item.key) {
            acc[item.key.toLowerCase()] = item.value; // Convert key to lowercase
        }
        return acc;
    }, {} as Record<string, string>);
    console.log('PathVariablesPanel: globalMap =', map);
    return map;
  }, [globals]);

  if (variables.length === 0) {
    return <EmptyState icon={<Link className="h-12 w-12 stroke-1" />} message="No path variables found in the URL. Use {{variable}} syntax to define one." />;
  }

  return (
    <div className="p-4">
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-4 text-xs font-semibold text-muted-foreground px-2">
          <div>Key</div>
          <div className="col-span-2">Value (Preview from globals/env or data)</div>
        </div>
        {variables.map(key => {
          // First check if the variable exists in globals/environment variables
          const globalValue = globalMap[key.toLowerCase()];
          // Then check if it exists in data (case-insensitive)
          const dataValue = data ? Object.entries(data).find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1] : undefined;
          // Use global value first, then data value, then show "Not found"
          const displayValue = globalValue || dataValue;
          const valueSource = globalValue ? 'Global/Env' : dataValue ? 'Data' : 'Not found';
          
          console.log(`PathVariablesPanel: key = ${key}, globalValue = ${globalValue}, dataValue = ${dataValue}, displayValue = ${displayValue}`);
          
          return (
            <div key={key} className="grid grid-cols-3 gap-4 items-center group p-2 rounded-md hover:bg-muted/50">
              <div className="font-mono text-sm text-foreground">{key}</div>
              <div className="col-span-2 font-mono text-sm text-amber-400 bg-muted px-2 py-1 rounded-md truncate" title={displayValue || 'Variable not found'}>
                {displayValue ? (
                  <span className="flex items-center gap-2">
                    <span>{displayValue}</span>
                    <span className="text-xs text-muted-foreground">({valueSource})</span>
                  </span>
                ) : (
                  <span className="text-destructive-text italic">Not found in data</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};