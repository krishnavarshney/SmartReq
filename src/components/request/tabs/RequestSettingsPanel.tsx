import React from 'react';
import { RequestSettings } from '../../../types';
import { Switch } from '../../ui/Switch';

interface RequestSettingsPanelProps {
  settings: RequestSettings;
  onSettingsChange: (settings: RequestSettings) => void;
}

export const RequestSettingsPanel: React.FC<RequestSettingsPanelProps> = ({ settings, onSettingsChange }) => {
  return (
    <div className="p-6 space-y-6">
       <div className="flex items-start justify-between">
        <div>
          <label htmlFor="follow-redirects" className="font-medium text-foreground cursor-pointer">Automatically follow redirects</label>
          <p className="text-sm text-muted-foreground mt-1">Follow HTTP 3xx responses as redirects.</p>
        </div>
        <Switch 
          id="follow-redirects"
          checked={settings.followRedirects}
          onCheckedChange={checked => onSettingsChange({ ...settings, followRedirects: checked })}
        />
      </div>
    </div>
  );
};