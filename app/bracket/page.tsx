"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import confetti from "canvas-confetti";
import Navbar from "@/components/Navbar";
import ConfirmModal from "@/components/ConfirmModal";
import { type Pair, type Team, getTeamName } from "@/lib/players";
import { fetchPairs, fetchBracket, saveBracket } from "@/lib/supabase-data";

interface Match {
  id: string;
  team1: Team | null;
  team2: Team | null;
  score1: string;
  score2: string;
  winner: Team | null;
}

interface BracketState {
  teams: Team[];
  quarterFinals: Match[];
  semiFinals: Match[];
  final: Match;
  champion: Team | null;
}

export default function BracketPage() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [bracket, setBracket] = useState<BracketState | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load pairs and bracket from Supabase (with localStorage fallback)
  useEffect(() => {
    async function loadData() {
      try {
        // Try Supabase first
        const dbPairs = await fetchPairs();
        const dbBracket = await fetchBracket<BracketState>();

        if (dbPairs.length > 0) {
          setPairs(dbPairs);
          if (dbBracket && dbBracket.teams?.length > 0) {
            fixBracketImagePaths(dbBracket);
            setBracket(dbBracket);
          } else {
            setBracket(createBracket(dbPairs));
          }
        } else {
          // Fallback to localStorage
          const saved = localStorage.getItem("pickleball-pairs");
          if (saved) {
            const loadedPairs: Pair[] = JSON.parse(saved);
            const fixedPairs = loadedPairs.map((p) => ({
              male: { ...p.male, image: p.male.image.startsWith("/") ? p.male.image : `/${p.male.image}` },
              female: { ...p.female, image: p.female.image.startsWith("/") ? p.female.image : `/${p.female.image}` },
            }));
            setPairs(fixedPairs);

            const bracketSaved = localStorage.getItem("pickleball-bracket");
            if (bracketSaved) {
              const bracketData: BracketState = JSON.parse(bracketSaved);
              fixBracketImagePaths(bracketData);
              setBracket(bracketData);
            } else {
              setBracket(createBracket(fixedPairs));
            }
          }
        }
      } catch {
        // Fallback to localStorage
        const saved = localStorage.getItem("pickleball-pairs");
        if (saved) {
          try {
            const loadedPairs: Pair[] = JSON.parse(saved);
            const fixedPairs = loadedPairs.map((p) => ({
              male: { ...p.male, image: p.male.image.startsWith("/") ? p.male.image : `/${p.male.image}` },
              female: { ...p.female, image: p.female.image.startsWith("/") ? p.female.image : `/${p.female.image}` },
            }));
            setPairs(fixedPairs);
            const bracketSaved = localStorage.getItem("pickleball-bracket");
            if (bracketSaved) {
              const bracketData: BracketState = JSON.parse(bracketSaved);
              fixBracketImagePaths(bracketData);
              setBracket(bracketData);
            } else {
              setBracket(createBracket(fixedPairs));
            }
          } catch {
            localStorage.removeItem("pickleball-pairs");
            localStorage.removeItem("pickleball-bracket");
          }
        }
      }
      setDataLoaded(true);
    }
    loadData();
  }, []);

  // Save bracket to both Supabase and localStorage
  useEffect(() => {
    if (!dataLoaded || !bracket) return;
    localStorage.setItem("pickleball-bracket", JSON.stringify(bracket));
    saveBracket(bracket);
  }, [bracket, dataLoaded]);

  const selectWinner = useCallback(
    (round: "qf" | "sf" | "final", matchIndex: number, slot: 1 | 2) => {
      if (!bracket) return;
      const newBracket = structuredClone(bracket);

      let match: Match;
      if (round === "qf") match = newBracket.quarterFinals[matchIndex];
      else if (round === "sf") match = newBracket.semiFinals[matchIndex];
      else match = newBracket.final;

      const winner = slot === 1 ? match.team1 : match.team2;
      if (!winner) return;
      match.winner = winner;

      // Propagate QF → SF: QF0,QF1 feed SF0; QF2,QF3 feed SF1
      if (round === "qf") {
        const sfIndex = matchIndex < 2 ? 0 : 1;
        const sfSlot = matchIndex % 2 === 0 ? 1 : 2;
        if (sfSlot === 1) newBracket.semiFinals[sfIndex].team1 = winner;
        else newBracket.semiFinals[sfIndex].team2 = winner;
      } else if (round === "sf") {
        if (matchIndex === 0) newBracket.final.team1 = winner;
        else newBracket.final.team2 = winner;
      } else {
        newBracket.champion = winner;
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.5 },
          colors: ["#f59e0b", "#f97316", "#10b981", "#3b82f6", "#ec4899"],
        });
      }

      setBracket(newBracket);
    },
    [bracket]
  );

  const updateScore = useCallback(
    (round: "qf" | "sf" | "final", matchIndex: number, slot: 1 | 2, value: string) => {
      if (!bracket) return;
      const newBracket = structuredClone(bracket);

      let match: Match;
      if (round === "qf") match = newBracket.quarterFinals[matchIndex];
      else if (round === "sf") match = newBracket.semiFinals[matchIndex];
      else match = newBracket.final;

      if (slot === 1) match.score1 = value;
      else match.score2 = value;

      setBracket(newBracket);
    },
    [bracket]
  );

  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; action: () => void } | null>(null);

  const shuffleBracket = () => {
    setConfirmAction({
      title: "🔀 Xáo trộn nhánh?",
      message: "Xáo trộn lại vị trí các đội? Tất cả kết quả trận đấu sẽ bị xóa.",
      action: () => {
        const shuffled = [...pairs].sort(() => Math.random() - 0.5);
        setBracket(createBracket(shuffled));
        setConfirmAction(null);
      },
    });
  };

  const resetBracket = () => {
    setConfirmAction({
      title: "🗑️ Xóa kết quả?",
      message: "Xóa tất cả kết quả trận đấu? Hành động này không thể hoàn tác.",
      action: () => {
        setBracket(createBracket(pairs));
        setConfirmAction(null);
      },
    });
  };

  // Empty state
  if (pairs.length === 0) {
    return (
      <>
        <Navbar />
        <main className="pt-20 min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <div className="text-6xl opacity-50">🏆</div>
            <p className="text-lg text-slate-500">Chưa có cặp nào! Hãy quay số trước.</p>
            <Link href="/">
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 text-white font-bold shadow-lg shadow-emerald-500/25"
              >
                🏓 Đi Quay Số
              </motion.span>
            </Link>
          </motion.div>
        </main>
      </>
    );
  }

  if (!bracket) return null;

  return (
    <>
      <Navbar />
      <main className="pt-16 sm:pt-20 pb-16 min-h-screen" style={{ background: "var(--bg-primary)" }}>
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-5 sm:py-8 px-4"
        >
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight">
            <span className="text-shimmer">NHÁNH ĐẤU LOẠI</span>
          </h1>
          <p className="text-sm sm:text-base mt-1.5 sm:mt-2" style={{ color: "var(--text-muted)" }}>
            {pairs.length} đội — Đấu loại trực tiếp — Seed 1 được BYE
          </p>
        </motion.section>

        {/* Mobile: Stacked rounds */}
        <div className="lg:hidden px-3 sm:px-6 space-y-6 max-w-lg mx-auto">
          <RoundSection title="Tứ Kết" matches={bracket.quarterFinals} round="qf" selectWinner={selectWinner} updateScore={updateScore} />
          <RoundSection title="Bán Kết" matches={bracket.semiFinals} round="sf" selectWinner={selectWinner} updateScore={updateScore} />
          <RoundSection title="🏆 Chung Kết" matches={[bracket.final]} round="final" selectWinner={selectWinner} updateScore={updateScore} isChampion />
        </div>

        {/* Desktop: Horizontal bracket */}
        <div className="hidden lg:block max-w-[1500px] mx-auto px-4 overflow-x-auto pb-8">
          <div className="flex items-center gap-0 min-w-max py-6 px-4">
            <RoundColumn title="Tứ Kết" matches={bracket.quarterFinals} round="qf" selectWinner={selectWinner} updateScore={updateScore} gap="gap-5" />
            <Connector height={145} />
            <RoundColumn title="Bán Kết" matches={bracket.semiFinals} round="sf" selectWinner={selectWinner} updateScore={updateScore} gap="gap-[180px]" />
            <Connector height={260} />
            <RoundColumn title="🏆 Chung Kết" matches={[bracket.final]} round="final" selectWinner={selectWinner} updateScore={updateScore} isChampion />
          </div>
        </div>

        {/* Champion */}
        <AnimatePresence>
          {bracket.champion && (
            <motion.section
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center py-6 sm:py-8 px-4"
            >
              <div className="inline-flex flex-col items-center gap-3 sm:gap-4 glass-card rounded-3xl p-5 sm:p-8 shadow-xl" style={{ border: "2px solid var(--gold)" }}>
                <div className="text-4xl sm:text-5xl animate-crown">👑</div>
                <h2 className="text-lg sm:text-xl font-black tracking-[0.3em] bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                  VÔ ĐỊCH
                </h2>
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden ring-4 ring-amber-400 shadow-lg">
                      <Image src={bracket.champion.pair.male.image} alt="" fill className="object-cover" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm" style={{ color: "var(--text-primary)" }}>{bracket.champion.pair.male.displayName}</span>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <span className="text-white font-black text-xs sm:text-sm">&</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden ring-4 ring-amber-400 shadow-lg">
                      <Image src={bracket.champion.pair.female.image} alt="" fill className="object-cover" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm" style={{ color: "var(--text-primary)" }}>{bracket.champion.pair.female.displayName}</span>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex justify-center gap-2 sm:gap-3 py-4 sm:py-6 flex-wrap px-4 sm:px-6">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={shuffleBracket}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold glass-card transition-all"
            style={{ color: "var(--text-secondary)" }}
          >
            🔀 Xáo trộn
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => window.print()}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold glass-card transition-all"
            style={{ color: "var(--text-secondary)" }}
          >
            🖨️ In nhánh đấu
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={resetBracket}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all hover:text-red-500"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
          >
            🗑️ Xoá kết quả
          </motion.button>
        </div>
      </main>

      <ConfirmModal
        visible={!!confirmAction}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        confirmText="Xác nhận"
        cancelText="Hủy"
        variant="warning"
        onConfirm={() => confirmAction?.action()}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}

/* ======== SUB-COMPONENTS ======== */

/* Mobile: Stacked round section */
function RoundSection({ title, matches, round, selectWinner, updateScore, isChampion = false }: {
  title: string;
  matches: Match[];
  round: "qf" | "sf" | "final";
  selectWinner: (round: "qf" | "sf" | "final", idx: number, slot: 1 | 2) => void;
  updateScore: (round: "qf" | "sf" | "final", idx: number, slot: 1 | 2, val: string) => void;
  isChampion?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: round === "qf" ? 0 : round === "sf" ? 0.2 : 0.4 }}>
      <div className={`text-[10px] sm:text-xs font-bold tracking-[0.15em] sm:tracking-[0.2em] uppercase text-center mb-3 px-4 py-1.5 rounded-full inline-flex mx-auto ${
        isChampion
          ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600"
          : ""
      }`} style={!isChampion ? { background: "var(--bg-hover)", color: "var(--text-muted)" } : undefined}>
        {title}
      </div>
      <div className="w-full flex justify-center mb-2">
        <div style={{ width: 0 }} />
      </div>
      <div className="space-y-3">
        {matches.map((match, idx) => (
          <MatchCard key={match.id} match={match} round={round} matchIndex={idx} delay={0} isChampion={isChampion} selectWinner={selectWinner} updateScore={updateScore} />
        ))}
      </div>
    </motion.div>
  );
}

/* Desktop: Vertical column */
function RoundColumn({ title, matches, round, selectWinner, updateScore, gap = "gap-8", isChampion = false }: {
  title: string;
  matches: Match[];
  round: "qf" | "sf" | "final";
  selectWinner: (round: "qf" | "sf" | "final", idx: number, slot: 1 | 2) => void;
  updateScore: (round: "qf" | "sf" | "final", idx: number, slot: 1 | 2, val: string) => void;
  gap?: string;
  isChampion?: boolean;
}) {
  const delayBase = round === "qf" ? 0 : round === "sf" ? 0.3 : 0.6;
  return (
    <div className="flex flex-col items-center min-w-[280px]">
      <div className={`text-xs font-bold tracking-[0.2em] uppercase mb-5 px-4 py-1.5 rounded-full ${
        isChampion
          ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 border border-amber-200"
          : ""
      }`} style={!isChampion ? { background: "var(--bg-hover)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" } : undefined}>
        {title}
      </div>
      <div className={`flex flex-col ${gap} justify-center`}>
        {matches.map((match, idx) => (
          <MatchCard key={match.id} match={match} round={round} matchIndex={idx} delay={delayBase + idx * 0.12} isChampion={isChampion} selectWinner={selectWinner} updateScore={updateScore} />
        ))}
      </div>
    </div>
  );
}

/* Match card */
function MatchCard({ match, round, matchIndex, delay, isChampion, selectWinner, updateScore }: {
  match: Match;
  round: "qf" | "sf" | "final";
  matchIndex: number;
  delay: number;
  isChampion: boolean;
  selectWinner: (round: "qf" | "sf" | "final", idx: number, slot: 1 | 2) => void;
  updateScore: (round: "qf" | "sf" | "final", idx: number, slot: 1 | 2, val: string) => void;
}) {
  const label = round === "qf" ? `Trận ${matchIndex + 1}` : round === "sf" ? `Bán kết ${matchIndex + 1}` : "Chung kết";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.02 }}
      className={`glass-card rounded-xl overflow-hidden w-full lg:w-[275px] transition-all ${
        isChampion && match.winner
          ? "shadow-lg"
          : "hover:shadow-lg"
      }`}
      style={isChampion && match.winner ? { border: "2px solid var(--gold)", boxShadow: "0 4px 20px rgba(245,158,11,0.15)" } : undefined}
    >
      {/* Match header */}
      <div className="text-[10px] font-bold tracking-[0.15em] text-center py-1.5 uppercase border-b" style={{ color: "var(--text-muted)", background: "var(--bg-hover)", borderColor: "var(--border-subtle)" }}>
        {label}
      </div>

      <TeamRow team={match.team1} score={match.score1} isWinner={match.winner?.seed === match.team1?.seed}
        onClick={() => selectWinner(round, matchIndex, 1)} onScoreChange={(val) => updateScore(round, matchIndex, 1, val)} />
      <div className="h-px" style={{ background: "var(--border-subtle)" }} />
      <TeamRow team={match.team2} score={match.score2} isWinner={match.winner?.seed === match.team2?.seed}
        isBye={!match.team2 && !!match.winner}
        onClick={() => selectWinner(round, matchIndex, 2)} onScoreChange={(val) => updateScore(round, matchIndex, 2, val)} />
    </motion.div>
  );
}

/* Team row inside match card */
function TeamRow({ team, score, isWinner, isBye = false, onClick, onScoreChange }: {
  team: Team | null;
  score: string;
  isWinner: boolean;
  isBye?: boolean;
  onClick: () => void;
  onScoreChange: (val: string) => void;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 opacity-30">
        <span className="text-xs font-bold w-5 text-center" style={{ color: "var(--text-muted)" }}>-</span>
        <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>{isBye ? "BYE" : "Chờ kết quả..."}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all ${isWinner ? "bg-emerald-500/10" : ""}`}
      style={!isWinner ? { background: "transparent" } : undefined}
      onClick={onClick}
      title="Click để chọn đội thắng"
    >
      <span className="text-[10px] sm:text-xs font-bold w-5 text-center" style={{ color: "var(--text-muted)" }}>{team.seed}</span>
      <div className="flex -space-x-1.5">
        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden ring-2 ring-blue-300">
          <Image src={team.pair.male.image} alt="" fill className="object-cover" />
        </div>
        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden ring-2 ring-pink-300">
          <Image src={team.pair.female.image} alt="" fill className="object-cover" />
        </div>
      </div>
      <span className="text-[11px] sm:text-xs font-semibold flex-1 truncate" style={{ color: "var(--text-primary)" }}>{team.name}</span>
      <input
        type="text"
        value={score}
        placeholder="-"
        maxLength={3}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onScoreChange(e.target.value)}
        className="w-9 sm:w-10 text-center text-xs font-bold rounded-md py-1 outline-none transition-all"
        style={{ color: "var(--gold-dark)", background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
      />
      {isWinner && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-500 font-bold text-xs">
          ✓
        </motion.span>
      )}
    </div>
  );
}

/* Desktop connector lines */
function Connector({ height }: { height: number }) {
  return (
    <div className="w-8 lg:w-10 flex flex-col justify-center">
      <div style={{ height }} className="border-r-2 border-t-2 border-b-2 rounded-r-lg" />
    </div>
  );
}

/* ======== HELPERS ======== */

function createBracket(pairs: Pair[]): BracketState {
  const teams: Team[] = pairs.map((pair, i) => ({
    seed: i + 1,
    pair,
    name: getTeamName(pair),
  }));

  // 7 teams → 8-slot bracket, seed 1 gets BYE
  const seed1 = teams[0] || null;
  const seed2 = teams[1] || null;
  const seed3 = teams[2] || null;
  const seed4 = teams[3] || null;
  const seed5 = teams[4] || null;
  const seed6 = teams[5] || null;
  const seed7 = teams[6] || null;

  return {
    teams,
    quarterFinals: [
      { id: "qf1", team1: seed1, team2: null, score1: "", score2: "", winner: seed1 },
      { id: "qf2", team1: seed4, team2: seed5, score1: "", score2: "", winner: null },
      { id: "qf3", team1: seed2, team2: seed7, score1: "", score2: "", winner: null },
      { id: "qf4", team1: seed3, team2: seed6, score1: "", score2: "", winner: null },
    ],
    semiFinals: [
      { id: "sf1", team1: seed1, team2: null, score1: "", score2: "", winner: null },
      { id: "sf2", team1: null, team2: null, score1: "", score2: "", winner: null },
    ],
    final: { id: "final", team1: null, team2: null, score1: "", score2: "", winner: null },
    champion: null,
  };
}

function fixTeamImagePaths(team: Team | null) {
  if (!team) return;
  if (!team.pair.male.image.startsWith("/")) team.pair.male.image = `/${team.pair.male.image}`;
  if (!team.pair.female.image.startsWith("/")) team.pair.female.image = `/${team.pair.female.image}`;
}

function fixBracketImagePaths(bracket: BracketState) {
  bracket.teams.forEach((t) => fixTeamImagePaths(t));
  bracket.quarterFinals.forEach((m) => { fixTeamImagePaths(m.team1); fixTeamImagePaths(m.team2); fixTeamImagePaths(m.winner); });
  bracket.semiFinals.forEach((m) => { fixTeamImagePaths(m.team1); fixTeamImagePaths(m.team2); fixTeamImagePaths(m.winner); });
  fixTeamImagePaths(bracket.final.team1);
  fixTeamImagePaths(bracket.final.team2);
  fixTeamImagePaths(bracket.final.winner);
  fixTeamImagePaths(bracket.champion);
}

