"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { Player } from "@/lib/players";

interface PairResultModalProps {
  male: Player | null;
  female: Player | null;
  visible: boolean;
  pairNumber: number;
  onClose: () => void;
}

export default function PairResultModal({
  male,
  female,
  visible,
  pairNumber,
  onClose,
}: PairResultModalProps) {
  if (!male || !female) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-md"
          style={{ background: "var(--modal-backdrop)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 text-center max-w-lg mx-3 sm:mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-4 sm:mb-6"
            >
              <span className="text-2xl sm:text-3xl">🏓</span>
              <h3 className="text-base sm:text-lg font-extrabold tracking-widest mt-1" style={{ color: "var(--gold)" }}>
                CẶP SỐ {pairNumber}
              </h3>
            </motion.div>

            {/* Players */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Male */}
              <motion.div
                initial={{ x: -40, opacity: 0, scale: 0 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="flex flex-col items-center gap-3"
              >
                <div className="relative w-18 h-18 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-4 ring-blue-400 shadow-lg" style={{ ringOffset: "var(--ring-offset)", '--tw-ring-offset-color': 'var(--ring-offset)', width: 'clamp(72px, 20vw, 96px)', height: 'clamp(72px, 20vw, 96px)' } as React.CSSProperties}>
                  <Image
                    src={male.image}
                    alt={male.displayName}
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="font-bold text-base sm:text-lg" style={{ color: "var(--male)" }}>
                  {male.displayName}
                </span>
              </motion.div>

              {/* VS Badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, var(--gold), var(--gold-dark))" }}>
                  <span className="text-white font-black text-[10px] sm:text-xs tracking-wider">VS</span>
                </div>
                <span className="text-[10px] font-bold tracking-widest" style={{ color: "var(--gold)" }}>MIXED</span>
              </motion.div>

              {/* Female */}
              <motion.div
                initial={{ x: 40, opacity: 0, scale: 0 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="flex flex-col items-center gap-3"
              >
                <div className="relative rounded-full overflow-hidden ring-4 ring-pink-400 shadow-lg" style={{ '--tw-ring-offset-color': 'var(--ring-offset)', width: 'clamp(72px, 20vw, 96px)', height: 'clamp(72px, 20vw, 96px)' } as React.CSSProperties}>
                  <Image
                    src={female.image}
                    alt={female.displayName}
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="font-bold text-base sm:text-lg" style={{ color: "var(--female)" }}>
                  {female.displayName}
                </span>
              </motion.div>
            </div>

            {/* Close button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="px-8 py-2.5 rounded-full font-bold text-sm tracking-wider shadow-lg transition-shadow"
              style={{ background: "linear-gradient(to right, var(--gold), var(--gold-dark))", color: "var(--bg-primary)" }}
            >
              Tiếp tục ▶
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
