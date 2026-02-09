import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X } from 'lucide-react';

export const LocationPopup = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check localStorage on mount
    const isClosed = localStorage.getItem('prefest_location_popup_closed');
    if (!isClosed) {
      // Small delay for better UX (don't show immediately on load)
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
    localStorage.setItem('prefest_location_popup_closed', 'true');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -20, x: "-50%" }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-24 left-1/2 z-[60] flex items-center gap-4 bg-white p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 max-w-[90vw] md:max-w-md w-fit"
        >
          {/* Icon wrapper */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin size={20} className="text-primary" />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-gray-900">Novidade!</span>
            <span className="text-sm text-gray-600 leading-tight">
              Descubra o que fazer perto de você
            </span>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className="ml-2 p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-full transition-colors cursor-pointer flex-shrink-0"
            aria-label="Fechar aviso"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
