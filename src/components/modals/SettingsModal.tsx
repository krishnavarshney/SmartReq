import React from 'react';
import { Button } from '../ui/Button';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { getApiKey, setApiKey } from '../../utils/apiKey';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  onClearCache: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ show, onClose, onClearCache }) => {
  const [confirming, setConfirming] = React.useState(false);
  const [keyDraft, setKeyDraft] = React.useState('');
  const [keySaved, setKeySaved] = React.useState(false);

  React.useEffect(() => {
    if (show) {
      setKeyDraft(getApiKey());
      setKeySaved(false);
      setConfirming(false);
    }
  }, [show]);

  const handleSaveKey = () => {
    setApiKey(keyDraft);
    setKeySaved(true);
  };

  return (
    <Modal show={show} onClose={onClose}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-foreground">Settings</h2>
        <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">&times;</button>
      </div>
      
      <div className="space-y-6">
          <div>
              <h3 className="font-semibold text-foreground">Theme</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                  Choose how you want the application to look. Select "System" to match your OS settings.
              </p>
              <ThemeSwitcher />
          </div>

          <div className="pt-6 border-t border-border">
              <h3 className="font-semibold text-foreground">Gemini API Key</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                  Used for AI insights, script generation and endpoint discovery. Stored in this browser only and never sent anywhere except Google's API.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={keyDraft}
                  onChange={e => { setKeyDraft(e.target.value); setKeySaved(false); }}
                  placeholder="AIza..."
                  aria-label="Gemini API key"
                />
                <Button onClick={handleSaveKey} variant="primary">Save</Button>
              </div>
              {keySaved && <p className="text-sm text-success-text mt-2">Saved.</p>}
          </div>
          
           <div className="pt-6 border-t border-border">
              <h3 className="font-semibold text-foreground">Application Data</h3>
              <p className="text-sm text-muted-foreground mt-1">
                  This will clear all saved data including request history and created tags. This action cannot be undone.
              </p>
              {!confirming ? (
                <Button onClick={() => setConfirming(true)} variant="destructive" className="mt-3">
                    Clear All Cached Data
                </Button>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  <Button onClick={onClearCache} variant="destructive">Confirm Clear</Button>
                  <Button onClick={() => setConfirming(false)} variant="secondary">Cancel</Button>
                </div>
              )}
          </div>
      </div>
    </Modal>
  );
};
