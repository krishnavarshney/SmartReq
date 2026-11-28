import React from 'react';
import { Spinner } from './Spinner';

interface LoaderProps {
  message: string;
  className?: string;
}

/** Centered spinner with a status line, for panels waiting on async work. */
export const Loader: React.FC<LoaderProps> = ({ message, className = '' }) => (
  <div role="status" aria-live="polite" className={`flex h-full flex-col items-center justify-center gap-2 p-4 text-center animate-fade-in ${className}`}>
    <Spinner className="h-5 w-5 text-muted-foreground" />
    <p className="text-[13px] text-muted-foreground">{message}</p>
  </div>
);
