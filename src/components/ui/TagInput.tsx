import React, { useState } from 'react';
import { XCircle } from '../icons';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({ tags, onTagsChange, placeholder = "Add values..." }) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !tags.includes(newTag)) {
        onTagsChange([...tags, newTag]);
      }
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-1.5 border border-border rounded-md themed-input focus-within:ring-2 focus-within:ring-ring">
      {tags.map(tag => (
        <div key={tag} className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded text-sm">
          <span>{tag}</span>
          <button onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-grow bg-transparent focus:outline-none text-sm min-w-[100px] h-6"
      />
    </div>
  );
};