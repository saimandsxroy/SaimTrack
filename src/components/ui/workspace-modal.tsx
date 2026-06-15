"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

export function WorkspaceModal({ isOpen, onClose, leftPanel, rightPanel, title }: WorkspaceModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const }}
            className="fixed left-[5vw] right-[5vw] top-[5vh] bottom-[5vh] z-50 flex flex-col bg-background rounded-2xl border border-border shadow-2xl overflow-hidden"
          >
            {/* Header / Top Bar */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-border shrink-0 bg-surface">
              <span className="text-[13px] font-medium text-text-secondary">{title || "Workspace"}</span>
              <button 
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Split Content */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
              {/* Left Side (70%) - Primary Content */}
              <div className="flex-[7] h-full overflow-y-auto px-8 md:px-16 py-12 scrollbar-thin">
                <div className="max-w-[800px] mx-auto w-full">
                  {leftPanel}
                </div>
              </div>

              {/* Right Side (30%) - Properties Panel */}
              <div className="flex-[3] h-full bg-surface-raised border-l border-border overflow-y-auto">
                {rightPanel}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
