import { useEffect, useState } from 'react';

/**
 * Hook to apply visual obfuscation when DevTools are detected.
 * Returns a CSS class or style object to blur/hide sensitive data.
 */
import { useDevToolsDetection } from './useDevToolsDetection';

export function useSensitiveDataProtection() {
  const isDevToolsOpen = useDevToolsDetection();
  
  // Return style to blur if DevTools is open
  const sensitiveStyle = isDevToolsOpen 
    ? { filter: 'blur(4px)', userSelect: 'none', transition: 'filter 0.3s ease' } as const
    : {};

  // Return mask function
  const maskText = (text: string, visibleChars = 4) => {
    if (isDevToolsOpen) return '••••••••';
    if (!text) return '';
    if (text.length <= visibleChars) return text;
    return '•'.repeat(text.length - visibleChars) + text.slice(-visibleChars);
  };

  return { sensitiveStyle, isDevToolsOpen, maskText };
}

