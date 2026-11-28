import React, { useEffect, useRef, useState } from 'react';

interface TypingAnimatorProps {
  text: string;
  className?: string;
  onComplete?: () => void;
}

/** Briefly types out `text` (used when a tab is auto-named). Respects reduced motion. */
export const TypingAnimator: React.FC<TypingAnimatorProps> = ({ text, className, onComplete }) => {
  const [count, setCount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!text || reduce) {
      setCount(text.length);
      onCompleteRef.current?.();
      return;
    }
    setCount(0);
    let i = 0;
    const step = Math.max(15, Math.min(40, 400 / text.length));
    const intervalId = setInterval(() => {
      i++;
      setCount(i);
      if (i >= text.length) {
        clearInterval(intervalId);
        onCompleteRef.current?.();
      }
    }, step);
    return () => clearInterval(intervalId);
  }, [text]);

  return (
    <span className={className} aria-label={text}>
      {text.slice(0, count)}
    </span>
  );
};
