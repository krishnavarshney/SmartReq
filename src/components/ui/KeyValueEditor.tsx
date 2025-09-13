import React, { useEffect, useState } from 'react';
import { KeyValueItem } from '../../types';
import { Input } from './Input';
import { IconButton, Button } from './Button';
import { Plus, Trash2, Link, Edit3 } from '../icons';
import { Checkbox } from './Checkbox';
import { Tooltip } from './Tooltip';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Modal } from './Modal';
import { Textarea } from './Textarea';

interface KeyValueEditorProps {
  items: KeyValueItem[];
  onItemsChange: (items: KeyValueItem[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  keySuggestions?: string[];
  layout?: 'table' | 'stacked';
  showEncodingToggle?: boolean;
  showBulkEdit?: boolean;
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({ 
    items, 
    onItemsChange,
    keyPlaceholder = "Key",
    valuePlaceholder = "Value",
    keySuggestions,
    layout = 'stacked',
    showEncodingToggle = false,
    showBulkEdit = false
}) => {

  const isMobile = useMediaQuery('(max-width: 640px)'); // Define a breakpoint for mobile
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditText, setBulkEditText] = useState('');
  
  const handleItemChange = (index: number, field: keyof KeyValueItem, value: string | boolean) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    onItemsChange(newItems);
  };

  const addItem = () => {
    onItemsChange([...items, { id: Date.now(), key: '', value: '', enabled: true, encode: true }]);
  };

  const deleteItem = (id: number) => {
    const newItems = items.filter(item => item.id !== id);
    if ((layout === 'table' || isMobile) && newItems.length === 0) {
        onItemsChange([{ id: Date.now(), key: '', value: '', enabled: true, encode: true }]);
    } else {
        onItemsChange(newItems);
    }
  };

  const openBulkEdit = () => {
    // Convert current items to bulk edit format
    const bulkText = items
      .filter(item => item.key || item.value)
      .map(item => `${item.key}:${item.value}`)
      .join('\n');
    setBulkEditText(bulkText);
    setIsBulkEditOpen(true);
  };

  const applyBulkEdit = () => {
    try {
      const lines = bulkEditText.split('\n').filter(line => line.trim());
      const newItems: KeyValueItem[] = lines.map((line, index) => {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':'); // Handle values that might contain colons
        return {
          id: Date.now() + index,
          key: key.trim(),
          value: value.trim(),
          enabled: true,
          encode: true
        };
      });

      // Add empty row if no items
      if (newItems.length === 0) {
        newItems.push({ id: Date.now(), key: '', value: '', enabled: true, encode: true });
      }

      onItemsChange(newItems);
      setIsBulkEditOpen(false);
    } catch (error) {
      console.error('Error parsing bulk edit:', error);
    }
  };

  useEffect(() => {
    if ((layout === 'table' || isMobile) && items.length > 0) {
        const lastItem = items[items.length - 1];
        if (lastItem.key || lastItem.value) {
            addItem();
        }
    }
  }, [items, layout, isMobile]);

  const currentLayout = isMobile ? 'stacked' : layout;

  if (currentLayout === 'stacked') {
    return (
        <div className="space-y-2">
            {items.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2 group p-2 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors duration-150">
                    <Checkbox
                        checked={item.enabled}
                        onCheckedChange={(checked) => handleItemChange(index, 'enabled', checked)}
                        aria-label="Enable/Disable item"
                    />
                    
                    <div className="flex-grow space-y-1.5">
                        <Input
                            type="text"
                            placeholder={keyPlaceholder}
                            value={item.key}
                            onChange={(e) => handleItemChange(index, 'key', e.target.value)}
                            className="w-full font-mono text-sm !h-8 bg-background/50 focus:bg-background"
                            list={keySuggestions ? "key-suggestions-list" : undefined}
                        />
                         <div className="flex items-center gap-2">
                            <Input
                                type="text"
                                placeholder={valuePlaceholder}
                                value={item.value}
                                onChange={(e) => handleItemChange(index, 'value', e.target.value)}
                                className="w-full font-mono text-sm !h-8 bg-background/50 focus:bg-background"
                            />
                            {showEncodingToggle && (
                                <Tooltip content={item.encode !== false ? 'URL Encoding is ON' : 'URL Encoding is OFF'}>
                                    <IconButton
                                        variant="ghost"
                                        onClick={() => handleItemChange(index, 'encode', item.encode === false)}
                                        className={`h-7 w-7 ${item.encode !== false ? 'text-primary' : 'text-muted-foreground'}`}
                                        aria-label="Toggle URL Encoding"
                                    >
                                        <Link className="h-4 w-4" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                    
                    <div>
                        <IconButton 
                            variant="ghost"
                            onClick={() => deleteItem(item.id)}
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Delete item"
                        >
                            <Trash2 className="w-4 h-4" />
                        </IconButton>
                    </div>
                </div>
            ))}
        
            <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={addItem} className="flex-1 justify-center">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Variable
                </Button>
                {showBulkEdit && (
                    <Button variant="outline" size="sm" onClick={openBulkEdit} className="flex-shrink-0">
                        <Edit3 className="w-4 h-4 mr-2" />
                        Bulk Edit
                    </Button>
                )}
            </div>

            {keySuggestions && (
                <datalist id="key-suggestions-list">
                    {keySuggestions.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                    ))}
                </datalist>
            )}

            {/* Bulk Edit Modal */}
            <Modal show={isBulkEditOpen} onClose={() => setIsBulkEditOpen(false)}>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold">Bulk Edit</h3>
                        <p className="text-sm text-muted-foreground">
                            Enter key-value pairs, one per line. Use format: <code className="bg-muted px-1 rounded">key:value</code>
                        </p>
                    </div>
                    <Textarea
                        value={bulkEditText}
                        onChange={(e) => setBulkEditText(e.target.value)}
                        placeholder={`key1:value1\nkey2:value2\nkey3:value3`}
                        className="font-mono text-sm h-32"
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setIsBulkEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={applyBulkEdit}>
                            Apply Changes
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
  }

  // Default table layout
  return (
    <div className="overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Key-Value Pairs</h4>
            {showBulkEdit && (
                <Button variant="outline" size="sm" onClick={openBulkEdit}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Bulk Edit
                </Button>
            )}
        </div>
        <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
                <tr>
                    <th className="w-10"></th>
                    <th className="p-2 text-left font-semibold">{keyPlaceholder}</th>
                    <th className="p-2 text-left font-semibold">{valuePlaceholder}</th>
                    {showEncodingToggle && <th className="w-10"></th>}
                    <th className="w-10"></th>
                </tr>
            </thead>
            <tbody>
                {items.map((item, index) => (
                    <tr key={item.id} className="group">
                        <td className="p-2 text-center">
                            <Checkbox
                                checked={item.enabled}
                                onCheckedChange={(checked) => handleItemChange(index, 'enabled', checked)}
                                aria-label="Enable/Disable item"
                            />
                        </td>
                        <td className="p-1">
                            <Input
                                type="text"
                                placeholder={keyPlaceholder}
                                value={item.key}
                                onChange={(e) => handleItemChange(index, 'key', e.target.value)}
                                className="w-full bg-transparent border-0 focus:bg-input focus:ring-1 !h-8"
                                list={keySuggestions ? "key-suggestions-list" : undefined}
                            />
                        </td>
                        <td className="p-1">
                            <Input
                                type="text"
                                placeholder={valuePlaceholder}
                                value={item.value}
                                onChange={(e) => handleItemChange(index, 'value', e.target.value)}
                                className="w-full bg-transparent border-0 focus:bg-input focus:ring-1 !h-8"
                            />
                        </td>
                         {showEncodingToggle && (
                            <td className="p-2 text-center">
                                <Tooltip content={item.encode !== false ? 'URL Encoding is ON' : 'URL Encoding is OFF'}>
                                    <IconButton
                                        variant="ghost"
                                        onClick={() => handleItemChange(index, 'encode', item.encode === false)}
                                        className={`h-7 w-7 ${item.encode !== false ? 'text-primary' : 'text-muted-foreground'}`}
                                        aria-label="Toggle URL Encoding"
                                    >
                                        <Link className="h-4 w-4" />
                                    </IconButton>
                                </Tooltip>
                            </td>
                        )}
                        <td className="p-2 text-center">
                            <IconButton 
                                variant="ghost"
                                onClick={() => deleteItem(item.id)}
                                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                                aria-label="Delete item"
                                disabled={items.length === 1 && !item.key && !item.value}
                            >
                                <Trash2 className="w-4 h-4" />
                            </IconButton>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={addItem} className="w-full justify-center">
                <Plus className="w-4 h-4 mr-2" />
                Add Variable
            </Button>
        </div>
        {keySuggestions && (
            <datalist id="key-suggestions-list">
                {keySuggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                ))}
            </datalist>
        )}

        {/* Bulk Edit Modal */}
        <Modal show={isBulkEditOpen} onClose={() => setIsBulkEditOpen(false)}>
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold">Bulk Edit</h3>
                    <p className="text-sm text-muted-foreground">
                        Enter key-value pairs, one per line. Use format: <code className="bg-muted px-1 rounded">key:value</code>
                    </p>
                </div>
                <Textarea
                    value={bulkEditText}
                    onChange={(e) => setBulkEditText(e.target.value)}
                    placeholder={`key1:value1\nkey2:value2\nkey3:value3`}
                    className="font-mono text-sm h-32"
                />
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setIsBulkEditOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={applyBulkEdit}>
                        Apply Changes
                    </Button>
                </div>
            </div>
        </Modal>
    </div>
  );
};