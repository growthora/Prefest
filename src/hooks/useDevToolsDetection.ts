import { useEffect, useState } from 'react';

/**
 * Hook to detect if DevTools are likely open.
 * Uses performance difference and window resizing heuristics.
 * NON-INTRUSIVE: Does not block user, only flags 'isDevToolsOpen'.
 */
export function useDevToolsDetection() {
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  
  // Feature flag check
  const isEnabled = import.meta.env.VITE_DEVTOOLS_GUARD === 'true';

  useEffect(() => {
    if (!isEnabled) return;

    const checkDevTools = () => {
      // Method 1: Window resize detection (DevTools often docked)
      // Only works if docked to side/bottom
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      
      if (widthThreshold || heightThreshold) {
        setIsDevToolsOpen(true);
        return;
      }

      // Method 2: Performance monitoring (console.log overhead or debugger statements)
      // We avoid debugger statements to not annoy legitimate devs or trigger breakpoints
      // Just rely on resizing for now as it's less prone to false positives in modern browsers
      
      setIsDevToolsOpen(false);
    };

    // Check on load
    checkDevTools();

    // Check on resize
    window.addEventListener('resize', checkDevTools);
    
    // Check periodically
    const interval = setInterval(checkDevTools, 2000);

    return () => {
      window.removeEventListener('resize', checkDevTools);
      clearInterval(interval);
    };
  }, [isEnabled]);

  return isDevToolsOpen;
}
