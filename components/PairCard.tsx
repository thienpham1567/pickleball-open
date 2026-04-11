"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { Pair } from "@/lib/players";

interface PairCardProps {
  pair: Pair;
  index: number;
}

export default function PairCard({ pair, index }: PairCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.12, type: "spring", stiffness: 200 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="glass-card rounded-2xl p-5 flex items-center gap-5 cursor-default group hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10 transition-all"
    >
      {/* Pair number */}
      <div className="text-3xl font-black bg-gradient-to-br from-emerald-400 to-blue-500 bg-clip-text text-transparent min-w-[48px] text-center">
        #{index + 1}
      </div>

      {/* Players */}
      <div className="flex flex-col gap-2 flex-1">
        {/* Male */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-blue-300 shadow-sm">
            <Image
              src={pair.male.image}
              alt={pair.male.displayName}
              fill
              className="object-cover"
            />
          </div>
          <span className="font-semibold text-sm text-slate-700">
            {pair.male.displayName}
          </span>
        </div>

        <span className="text-xs font-bold text-amber-500 tracking-widest pl-[52px]">
          &
        </span>

        {/* Female */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-pink-300 shadow-sm">
            <Image
              src={pair.female.image}
              alt={pair.female.displayName}
              fill
              className="object-cover"
            />
          </div>
          <span className="font-semibold text-sm text-slate-700">
            {pair.female.displayName}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
