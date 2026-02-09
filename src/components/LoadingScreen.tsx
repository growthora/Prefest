import React from 'react';
import { motion } from 'framer-motion';
import logoImage from '@/assets/PHOTO-2026-02-02-13-32-10_-_cópia-removebg-preview.png';

export const LoadingScreen = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center"
    >
      <div className="relative flex flex-col items-center">
        <motion.img
          src={logoImage}
          alt="Pré-fest Loading"
          className="h-16 md:h-20 w-auto object-contain mb-8"
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Barra de progresso sutil */}
        <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
        
        <motion.p 
          className="mt-4 text-sm text-gray-400 font-medium tracking-wide"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Carregando experiências...
        </motion.p>
      </div>
    </motion.div>
  );
};
