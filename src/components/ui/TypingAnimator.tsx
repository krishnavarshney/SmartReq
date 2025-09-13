import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TypingAnimatorProps {
  text: string;
  className?: string;
  onComplete?: () => void;
}

const CURSOR_BLINK_TRANSITION = {
  duration: 0.4,
  repeat: Infinity,
  repeatType: 'reverse' as const,
  ease: 'easeInOut' as const,
};

export const TypingAnimator: React.FC<TypingAnimatorProps> = ({ text, className, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText(''); // Reset on text change
    if (text) {
      let i = 0;
      const intervalId = setInterval(() => {
        setDisplayedText(prev => prev + text.charAt(i));
        i++;
        if (i >= text.length) {
          clearInterval(intervalId);
          if (onComplete) {
            onComplete();
          }
        }
      }, 50); // Typing speed
      return () => clearInterval(intervalId);
    }
  }, [text, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      <motion.span
        className="inline-block h-3.5 w-px bg-current ml-px"
        animate={{ opacity: [0, 1] }}
        transition={CURSOR_BLINK_TRANSITION}
      />
    </span>
  );
};