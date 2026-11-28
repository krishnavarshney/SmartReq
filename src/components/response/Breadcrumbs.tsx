import React from 'react';
import { ChevronRight } from '../icons';

interface BreadcrumbsProps {
  path: string[];
  onPathClick: (index: number) => void;
  onRootClick: () => void;
  /** Optional content rendered on the right (e.g. row counts). */
  trailing?: React.ReactNode;
}

const isIndex = (s: string) => /^\d+$/.test(s);

/** Path through the JSON document shown above the table view. */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ path, onPathClick, onRootClick, trailing }) => {
  const crumb = 'h-6 max-w-[12rem] truncate rounded px-1.5 font-mono text-xs focus-ring';
  return (
    <div className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-border px-2">
      <nav aria-label="JSON path" className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        <button
          type="button"
          onClick={onRootClick}
          aria-current={path.length === 0 ? 'location' : undefined}
          className={`${crumb} ${path.length === 0 ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
        >
          root
        </button>
        {path.map((segment, index) => {
          const last = index === path.length - 1;
          return (
            <React.Fragment key={index}>
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onPathClick(index)}
                aria-current={last ? 'location' : undefined}
                title={segment}
                className={`${crumb} flex-shrink-0 ${last ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              >
                {isIndex(segment) ? `[${segment}]` : segment}
              </button>
            </React.Fragment>
          );
        })}
      </nav>
      {trailing && <div className="flex flex-shrink-0 items-center gap-2 text-[11px] tabular-nums text-muted-foreground">{trailing}</div>}
    </div>
  );
};
