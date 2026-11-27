import React from 'react';
import { StatusTone, toneBadgeClass } from '../../utils/http-ui';

interface BadgeProps {
  tone?: StatusTone | 'primary';
  children: React.ReactNode;
  className?: string;
  /** Show a leading status dot. */
  dot?: boolean;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', children, className = '', dot, title }) => {
  const toneClass = tone === 'primary' ? 'bg-primary/10 text-primary' : toneBadgeClass(tone);
  return (
    <span title={title} className={`inline-flex h-5 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[11px] font-semibold tabular-nums ${toneClass} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
};
