import React from 'react';
import { Sparkles } from '../icons';

interface LoaderProps {
  message: string;
}

export const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <Sparkles className="h-8 w-8 text-primary animate-pulse" />
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
};
