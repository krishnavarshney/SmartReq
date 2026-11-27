import React, { useId } from 'react';

/** Brand mark: a request arrow inside a rounded square, on the brand gradient. */
export const Logo: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id}-g)`} />
      <path d="M9 12h11.5l-3-3M23 20H11.5l3 3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
