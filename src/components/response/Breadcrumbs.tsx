import React from 'react';
import { ChevronRight } from '../icons';

interface BreadcrumbsProps {
  path: string[];
  onPathClick: (index: number) => void;
  onRootClick: () => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ path, onPathClick, onRootClick }) => {
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground p-2 border-b border-border flex-shrink-0">
      <button onClick={onRootClick} className="hover:text-foreground hover:underline">
        Root
      </button>
      {path.map((segment, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          <button
            onClick={() => onPathClick(index)}
            className={`hover:text-foreground hover:underline truncate ${index === path.length - 1 ? 'text-foreground font-semibold' : ''}`}
            title={segment}
          >
            {segment}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};