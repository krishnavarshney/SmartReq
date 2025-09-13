import React from 'react';
import { Button } from './ui/Button';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  onClearCache: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ show, onClose, onClearCache }) => {
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
              <h3 className="font-semibold text-foreground">Application Data</h3>
              <p className="text-sm text-muted-foreground mt-1">
                  This will clear all saved data including request history and created tags. This action cannot be undone.
              </p>
              <Button onClick={onClearCache} variant="destructive" className="mt-3">
                  Clear All Cached Data
              </Button>
          </div>
      </div>
    </Modal>
  );
};