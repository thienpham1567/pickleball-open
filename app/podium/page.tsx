"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import confetti from "canvas-confetti";
import Navbar from "@/components/Navbar";
import { type Team } from "@/lib/players";
import { fetchBracket } from "@/lib/supabase-data";
import { useSearchParams } from "next/navigation";

interface TournamentState {
  teams: Team[];
  champion: Team | null;
  thirdPlaceWinner: Team | null;
  final: { winner: Team | null; team1: Team | null; team2: Team | null };
  thirdPlace: { winner: Team | null; team1: Team | null; team2: Team | null };
}

interface PodiumTeam {
  team: Team;
  rank: 1 | 2 | 3;
}

const PLACEHOLDER = "/hinhmn/player-placeholder.svg";

function makeDemoTeam(seed: number, maleName: string, femaleName: string): Team {
  return {
    seed,
    name: `${maleName} & ${femaleName}`,
    pair: {
      male: { id: `m${seed}`, name: maleName, displayName: maleName, image: PLACEHOLDER, gender: "male" as const },
      female: { id: `f${seed}`, name: femaleName, displayName: femaleName, image: PLACEHOLDER, gender: "female" as const },
    },
  };
}

export default function PodiumPage() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const [podium, setPodium] = useState<PodiumTeam[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (isDemo) {
        // Demo mode with placeholder data
        setPodium([
          { team: makeDemoTeam(1, "Player A", "Player B"), rank: 1 },
          { team: makeDemoTeam(2, "Player C", "Player D"), rank: 2 },
          { team: makeDemoTeam(3, "Player E", "Player F"), rank: 3 },
        ]);
        setLoading(false);
        return;
      }

      try {
        const data = await fetchBracket<TournamentState>();
        if (!data) { setLoading(false); return; }

        const results: PodiumTeam[] = [];

        // Champion = final winner
        if (data.champion) {
          results.push({ team: data.champion, rank: 1 });
        }

        // Runner-up = final loser
        if (data.final?.winner && data.final.team1 && data.final.team2) {
          const runnerUp = data.final.winner.seed === data.final.team1.seed ? data.final.team2 : data.final.team1;
          results.push({ team: runnerUp, rank: 2 });
        }

        // 3rd place = third place match winner
        if (data.thirdPlaceWinner) {
          results.push({ team: data.thirdPlaceWinner, rank: 3 });
        }

        setPodium(results);
      } catch {
        console.warn("Failed to load podium data");
      }
      setLoading(false);
    }
    load();
  }, [isDemo]);

  // Fire confetti when revealed
  useEffect(() => {
    if (!revealed || podium.length === 0) return;

    const timer1 = setTimeout(() => {
      confetti({ particleCount: 150, spread: 90, origin: { x: 0.5, y: 0.3 }, colors: ["#FFD700", "#FFA500", "#FF6347", "#00CED1", "#FF69B4"] });
    }, 300);

    const timer2 = setTimeout(() => {
      confetti({ particleCount: 100, spread: 120, origin: { x: 0.2, y: 0.5 }, colors: ["#C0C0C0", "#A8A8A8", "#D4D4D4"] });
      confetti({ particleCount: 100, spread: 120, origin: { x: 0.8, y: 0.5 }, colors: ["#CD7F32", "#B87333", "#DAA520"] });
    }, 800);

    const timer3 = setTimeout(() => {
      confetti({ particleCount: 200, spread: 160, origin: { x: 0.5, y: 0.4 }, colors: ["#FFD700", "#FFA500", "#FF6347", "#00CED1", "#FF69B4", "#C0C0C0", "#CD7F32"] });
    }, 1500);

    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
  }, [revealed, podium]);

  // Auto reveal after load
  useEffect(() => {
    if (podium.length > 0) {
      const t = setTimeout(() => setRevealed(true), 500);
      return () => clearTimeout(t);
    }
  }, [podium]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="pt-20 min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="text-4xl">🏓</motion.div>
        </main>
      </>
    );
  }

  if (podium.length === 0) {
    return (
      <>
        <Navbar />
        <main className="pt-20 min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
            <div className="text-6xl opacity-50">🏆</div>
            <p className="text-lg" style={{ color: "var(--text-muted)" }}>Giải đấu chưa kết thúc!</p>
            <Link href="/bracket">
              <motion.span whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold shadow-lg">
                ← Về Nhánh Đấu
              </motion.span>
            </Link>
          </motion.div>
        </main>
      </>
    );
  }

  const champion = podium.find((p) => p.rank === 1);
  const runnerUp = podium.find((p) => p.rank === 2);
  const thirdPlace = podium.find((p) => p.rank === 3);

  return (
    <>
      <Navbar />
      <main className="pt-16 sm:pt-20 min-h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
        {/* Background glow effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #FFD700 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5" style={{ background: "radial-gradient(circle, #C0C0C0 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-5" style={{ background: "radial-gradient(circle, #CD7F32 0%, transparent 70%)" }} />
        </div>

        {/* Title */}
        <AnimatePresence>
          {revealed && (
            <motion.section
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-center pt-4 sm:pt-8 pb-6 sm:pb-10 px-4 relative z-10"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="text-4xl sm:text-6xl mb-3"
              >
                🏆
              </motion.div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight">
                <span className="text-shimmer">BẢNG VÀNG VINH DANH</span>
              </h1>
              <p className="text-sm sm:text-base mt-2" style={{ color: "var(--text-muted)" }}>
                PICKLEBALL TÂN PHÚ OPEN
              </p>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Podium */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-8">
          <div className="flex items-end justify-center gap-3 sm:gap-6 md:gap-8">
            {/* 2nd Place - Left */}
            <AnimatePresence>
              {revealed && runnerUp && (
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.8, ease: "easeOut" }}
                  className="flex flex-col items-center w-[140px] sm:w-[200px] md:w-[240px]"
                >
                  <PlayerCard team={runnerUp.team} rank={2} />
                  <div className="w-full mt-3 sm:mt-4 rounded-t-2xl flex items-center justify-center py-6 sm:py-10 md:py-14 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #94a3b8 0%, #64748b 100%)" }}>
                    <div className="absolute inset-0 opacity-20" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)" }} />
                    <span className="text-3xl sm:text-5xl md:text-6xl font-black text-white/90 relative z-10">2</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 1st Place - Center (tallest) */}
            <AnimatePresence>
              {revealed && champion && (
                <motion.div
                  initial={{ opacity: 0, y: 150 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                  className="flex flex-col items-center w-[160px] sm:w-[230px] md:w-[280px]"
                >
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className="text-3xl sm:text-5xl mb-2"
                  >
                    👑
                  </motion.div>
                  <PlayerCard team={champion.team} rank={1} isChampion />
                  <div className="w-full mt-3 sm:mt-4 rounded-t-2xl flex items-center justify-center py-10 sm:py-16 md:py-24 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #f59e0b 0%, #d97706 50%, #b45309 100%)" }}>
                    <div className="absolute inset-0 opacity-30" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)" }} />
                    {/* Gold shimmer */}
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                      className="absolute inset-0 opacity-20"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)", width: "50%" }}
                    />
                    <span className="text-4xl sm:text-6xl md:text-7xl font-black text-white relative z-10">1</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 3rd Place - Right */}
            <AnimatePresence>
              {revealed && thirdPlace && (
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3, duration: 0.8, ease: "easeOut" }}
                  className="flex flex-col items-center w-[140px] sm:w-[200px] md:w-[240px]"
                >
                  <PlayerCard team={thirdPlace.team} rank={3} />
                  <div className="w-full mt-3 sm:mt-4 rounded-t-2xl flex items-center justify-center py-4 sm:py-8 md:py-10 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #d97706 0%, #92400e 100%)" }}>
                    <div className="absolute inset-0 opacity-20" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)" }} />
                    <span className="text-3xl sm:text-5xl md:text-6xl font-black text-white/90 relative z-10">3</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Details cards */}
        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2, duration: 0.6 }}
              className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 relative z-10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                {[champion, runnerUp, thirdPlace].filter(Boolean).map((p) => {
                  if (!p) return null;
                  const config = rankConfig[p.rank];
                  return (
                    <motion.div
                      key={p.team.seed}
                      whileHover={{ scale: 1.03, y: -4 }}
                      className="glass-card rounded-2xl overflow-hidden"
                      style={{ border: `2px solid ${config.borderColor}` }}
                    >
                      <div className="p-1.5" style={{ background: config.gradient }}>
                        <div className="text-center text-white text-xs sm:text-sm font-bold tracking-wider uppercase">
                          {config.icon} {config.label}
                        </div>
                      </div>
                      <div className="p-4 sm:p-5 text-center space-y-3">
                        <div className="flex justify-center gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-3 ${config.ringClass} shadow-lg`}>
                              <Image src={p.team.pair.male.image} alt="" fill className="object-cover" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold mt-1.5" style={{ color: "var(--text-primary)" }}>{p.team.pair.male.displayName}</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shadow-md" style={{ background: config.gradient }}>
                              <span className="text-white font-black text-[9px]">&</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-3 ${config.ringClass} shadow-lg`}>
                              <Image src={p.team.pair.female.image} alt="" fill className="object-cover" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold mt-1.5" style={{ color: "var(--text-primary)" }}>{p.team.pair.female.displayName}</span>
                          </div>
                        </div>
                        <div className="text-sm sm:text-base font-bold" style={{ color: config.textColor }}>
                          {p.team.name}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back link */}
        <div className="text-center pb-12 relative z-10">
          <Link href="/bracket">
            <motion.span whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium px-5 py-2 rounded-full glass-card" style={{ color: "var(--text-secondary)" }}>
              ← Về Nhánh Đấu
            </motion.span>
          </Link>
        </div>
      </main>
    </>
  );
}

/* ======== PLAYER CARD ======== */

function PlayerCard({ team, rank, isChampion = false }: { team: Team; rank: 1 | 2 | 3; isChampion?: boolean }) {
  const config = rankConfig[rank];
  const imgSize = isChampion ? "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24" : "w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20";

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`glass-card rounded-2xl p-3 sm:p-4 text-center w-full ${isChampion ? "shadow-2xl" : "shadow-lg"}`}
      style={{ border: `2px solid ${config.borderColor}`, boxShadow: isChampion ? `0 8px 40px ${config.glowColor}` : undefined }}
    >
      <div className="flex justify-center gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="flex flex-col items-center">
          <div className={`relative ${imgSize} rounded-full overflow-hidden ring-3 ${config.ringClass} shadow-lg`}>
            <Image src={team.pair.male.image} alt="" fill className="object-cover" />
          </div>
          <span className="text-[9px] sm:text-[10px] font-bold mt-1" style={{ color: "var(--text-secondary)" }}>{team.pair.male.displayName}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className={`relative ${imgSize} rounded-full overflow-hidden ring-3 ${config.ringClass} shadow-lg`}>
            <Image src={team.pair.female.image} alt="" fill className="object-cover" />
          </div>
          <span className="text-[9px] sm:text-[10px] font-bold mt-1" style={{ color: "var(--text-secondary)" }}>{team.pair.female.displayName}</span>
        </div>
      </div>
      <div className={`text-[10px] sm:text-xs font-bold truncate ${isChampion ? "sm:text-sm" : ""}`} style={{ color: config.textColor }}>
        {team.name}
      </div>
    </motion.div>
  );
}

/* ======== CONFIG ======== */

const rankConfig: Record<1 | 2 | 3, {
  label: string;
  icon: string;
  gradient: string;
  borderColor: string;
  glowColor: string;
  textColor: string;
  ringClass: string;
}> = {
  1: {
    label: "VÔ ĐỊCH",
    icon: "🏆",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    borderColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.25)",
    textColor: "#f59e0b",
    ringClass: "ring-amber-400",
  },
  2: {
    label: "Á QUÂN",
    icon: "🥈",
    gradient: "linear-gradient(135deg, #94a3b8, #64748b)",
    borderColor: "#94a3b8",
    glowColor: "rgba(148, 163, 184, 0.2)",
    textColor: "#94a3b8",
    ringClass: "ring-slate-400",
  },
  3: {
    label: "HẠNG BA",
    icon: "🥉",
    gradient: "linear-gradient(135deg, #d97706, #92400e)",
    borderColor: "#d97706",
    glowColor: "rgba(217, 119, 6, 0.2)",
    textColor: "#d97706",
    ringClass: "ring-amber-600",
  },
};
