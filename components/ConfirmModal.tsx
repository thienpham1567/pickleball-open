"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center backdrop-blur-md"
          style={{ background: "var(--modal-backdrop)" }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass-card rounded-2xl p-6 max-w-sm mx-4 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning icon */}
            <div
              className={`w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center ${
                variant === "danger"
                  ? "bg-red-50 text-red-500"
                  : "bg-amber-50 text-amber-500"
              }`}
            >
              <svg
                className="w-7 h-7"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-slate-100 mb-2">{title}</h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">{message}</p>

            <div className="flex gap-3 justify-center">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onCancel}
                className="px-6 py-2.5 rounded-full text-sm font-semibold text-slate-300 border border-slate-600 hover:bg-white/5 transition-all"
              >
                {cancelText}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                className={`px-6 py-2.5 rounded-full text-sm font-bold text-white shadow-lg transition-all ${
                  variant === "danger"
                    ? "bg-gradient-to-r from-red-500 to-rose-500 shadow-red-500/25 hover:shadow-red-500/40"
                    : "bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/25 hover:shadow-amber-500/40"
                }`}
              >
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
