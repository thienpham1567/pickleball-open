"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import confetti from "canvas-confetti";
import Navbar from "@/components/Navbar";
import ConfirmModal from "@/components/ConfirmModal";
import { type Pair, type Team, getTeamName } from "@/lib/players";
import { fetchPairs, fetchBracket, saveBracket } from "@/lib/supabase-data";

/* ======== TYPES ======== */

interface GroupMatch {
  id: string;
  team1Seed: number;
  team2Seed: number;
  score1: string;
  score2: string;
}

interface Group {
  name: string;
  teamSeeds: number[];
  matches: GroupMatch[];
}

interface KOMatch {
  id: string;
  team1: Team | null;
  team2: Team | null;
  score1: string;
  score2: string;
  winner: Team | null;
}

interface TournamentState {
  teams: Team[];
  groups: Group[];
  quarterFinals: KOMatch[];
  semiFinals: KOMatch[];
  final: KOMatch;
  thirdPlace: KOMatch;
  champion: Team | null;
  thirdPlaceWinner: Team | null;
  qfDrawn: boolean;
}

interface Standing {
  team: Team;
  played: number;
  won: number;
  lost: number;
  pf: number;
  pa: number;
  diff: number;
}

type TabId = "groups" | "knockout";

/* ======== PAGE ======== */

export default function BracketPage() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("groups");
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; action: () => void } | null>(null);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const dbPairs = await fetchPairs();
        const dbBracket = await fetchBracket<TournamentState>();

        if (dbPairs.length > 0) {
          setPairs(dbPairs);
          if (dbBracket && dbBracket.groups?.length > 0) {
            fixAllImagePaths(dbBracket);
            setTournament(dbBracket);
          } else {
            setTournament(createTournament(dbPairs, false));
          }
        }
      } catch {
        console.warn("Failed to load tournament data");
      }
      setDataLoaded(true);
    }
    loadData();
  }, []);

  // Save to Supabase only (no localStorage)
  useEffect(() => {
    if (!dataLoaded || !tournament) return;
    saveBracket(tournament);
  }, [tournament, dataLoaded]);

  // Check if groups have been drawn
  const groupsDrawn = tournament?.groups?.some((g) => g.teamSeeds.length > 0) ?? false;

  // Helpers to find team by seed
  const teamBySeed = useCallback(
    (seed: number): Team | null => {
      return tournament?.teams.find((t) => t.seed === seed) ?? null;
    },
    [tournament]
  );

  // Compute group standings
  const getStandings = useCallback(
    (group: Group): Standing[] => {
      if (!tournament) return [];
      const standings: Map<number, Standing> = new Map();

      group.teamSeeds.forEach((seed) => {
        const team = teamBySeed(seed);
        if (team) {
          standings.set(seed, { team, played: 0, won: 0, lost: 0, pf: 0, pa: 0, diff: 0 });
        }
      });

      group.matches.forEach((m) => {
        const s1 = parseInt(m.score1);
        const s2 = parseInt(m.score2);
        if (isNaN(s1) || isNaN(s2)) return;

        const st1 = standings.get(m.team1Seed);
        const st2 = standings.get(m.team2Seed);
        if (!st1 || !st2) return;

        st1.played++;
        st2.played++;
        st1.pf += s1;
        st1.pa += s2;
        st2.pf += s2;
        st2.pa += s1;

        if (s1 > s2) {
          st1.won++;
          st2.lost++;
        } else if (s2 > s1) {
          st2.won++;
          st1.lost++;
        }

        st1.diff = st1.pf - st1.pa;
        st2.diff = st2.pf - st2.pa;
      });

      return Array.from(standings.values()).sort((a, b) => {
        if (b.won !== a.won) return b.won - a.won;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.pf - a.pf;
      });
    },
    [tournament, teamBySeed]
  );

  // Get all standings across groups for best 3rd place calculation
  const allGroupStandings = useMemo(() => {
    if (!tournament) return [];
    return tournament.groups.map((g) => getStandings(g));
  }, [tournament, getStandings]);

  // Get advancing teams (top 2 each group + 2 best 3rd)
  const advancingTeams = useMemo(() => {
    if (allGroupStandings.length === 0) return [];

    const top2: Team[] = [];
    const thirds: Standing[] = [];

    allGroupStandings.forEach((standings) => {
      if (standings.length >= 2 && standings[0].played > 0 && standings[1].played > 0) {
        top2.push(standings[0].team, standings[1].team);
      }
      if (standings.length >= 3 && standings[2].played > 0) {
        thirds.push(standings[2]);
      }
    });

    thirds.sort((a, b) => {
      if (b.won !== a.won) return b.won - a.won;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.pf - a.pf;
    });

    const best3rd = thirds.slice(0, 2).map((s) => s.team);
    return [...top2, ...best3rd];
  }, [allGroupStandings]);

  const allGroupsComplete = useMemo(() => {
    if (!tournament) return false;
    return tournament.groups.every((g) =>
      g.matches.every((m) => {
        const s1 = parseInt(m.score1);
        const s2 = parseInt(m.score2);
        return !isNaN(s1) && !isNaN(s2) && s1 !== s2;
      })
    );
  }, [tournament]);

  // Update group match score
  const updateGroupScore = useCallback(
    (groupIndex: number, matchIndex: number, slot: 1 | 2, value: string) => {
      if (!tournament) return;
      const newT = structuredClone(tournament);
      const match = newT.groups[groupIndex].matches[matchIndex];
      if (slot === 1) match.score1 = value;
      else match.score2 = value;
      setTournament(newT);
    },
    [tournament]
  );

  // Random draw for groups
  const randomDrawGroups = useCallback(() => {
    if (!tournament) return;
    setConfirmAction({
      title: "Chia bảng ngẫu nhiên?",
      message: `${tournament.teams.length} đội sẽ được xáo trộn và chia vào 3 bảng.`,
      action: () => {
        const shuffled = [...tournament.teams].sort(() => Math.random() - 0.5);
        const newT = structuredClone(tournament);
        const groupNames = ["A", "B", "C"];
        const groups: Group[] = [];

        for (let g = 0; g < 3; g++) {
          const groupTeams = shuffled.slice(g * 3, g * 3 + 3);
          const seeds = groupTeams.map((t) => t.seed);
          const matches: GroupMatch[] = [];

          for (let i = 0; i < seeds.length; i++) {
            for (let j = i + 1; j < seeds.length; j++) {
              matches.push({ id: `g${g}-m${matches.length}`, team1Seed: seeds[i], team2Seed: seeds[j], score1: "", score2: "" });
            }
          }

          groups.push({ name: groupNames[g], teamSeeds: seeds, matches });
        }

        newT.groups = groups;
        newT.qfDrawn = false;
        newT.quarterFinals = Array.from({ length: 4 }, (_, i) => ({ id: `qf${i + 1}`, team1: null, team2: null, score1: "", score2: "", winner: null }));
        newT.semiFinals = Array.from({ length: 2 }, (_, i) => ({ id: `sf${i + 1}`, team1: null, team2: null, score1: "", score2: "", winner: null }));
        newT.final = { id: "final", team1: null, team2: null, score1: "", score2: "", winner: null };
        newT.thirdPlace = { id: "third", team1: null, team2: null, score1: "", score2: "", winner: null };
        newT.champion = null;
        newT.thirdPlaceWinner = null;
        setTournament(newT);
        setConfirmAction(null);
      },
    });
  }, [tournament]);

  // Draw QF
  const drawQuarterFinals = useCallback(() => {
    if (!tournament || advancingTeams.length < 8) return;
    setConfirmAction({
      title: "Bốc thăm tứ kết?",
      message: `${advancingTeams.length} đội sẽ được xáo trộn và xếp vào 4 trận tứ kết.`,
      action: () => {
        const shuffled = [...advancingTeams].sort(() => Math.random() - 0.5);
        const newT = structuredClone(tournament);
        newT.quarterFinals = [
          { id: "qf1", team1: shuffled[0], team2: shuffled[1], score1: "", score2: "", winner: null },
          { id: "qf2", team1: shuffled[2], team2: shuffled[3], score1: "", score2: "", winner: null },
          { id: "qf3", team1: shuffled[4], team2: shuffled[5], score1: "", score2: "", winner: null },
          { id: "qf4", team1: shuffled[6], team2: shuffled[7], score1: "", score2: "", winner: null },
        ];
        newT.semiFinals = [
          { id: "sf1", team1: null, team2: null, score1: "", score2: "", winner: null },
          { id: "sf2", team1: null, team2: null, score1: "", score2: "", winner: null },
        ];
        newT.final = { id: "final", team1: null, team2: null, score1: "", score2: "", winner: null };
        newT.thirdPlace = { id: "third", team1: null, team2: null, score1: "", score2: "", winner: null };
        newT.champion = null;
        newT.thirdPlaceWinner = null;
        newT.qfDrawn = true;
        setTournament(newT);
        setActiveTab("knockout");
        setConfirmAction(null);
      },
    });
  }, [tournament, advancingTeams]);

  // Select winner in knockout
  const selectWinner = useCallback(
    (round: "qf" | "sf" | "final" | "third", matchIndex: number, slot: 1 | 2) => {
      if (!tournament) return;
      const newT = structuredClone(tournament);

      let match: KOMatch;
      if (round === "qf") match = newT.quarterFinals[matchIndex];
      else if (round === "sf") match = newT.semiFinals[matchIndex];
      else if (round === "third") match = newT.thirdPlace;
      else match = newT.final;

      const winner = slot === 1 ? match.team1 : match.team2;
      const loser = slot === 1 ? match.team2 : match.team1;
      if (!winner) return;
      match.winner = winner;

      if (round === "qf") {
        const sfIndex = matchIndex < 2 ? 0 : 1;
        const sfSlot = matchIndex % 2 === 0 ? 1 : 2;
        if (sfSlot === 1) newT.semiFinals[sfIndex].team1 = winner;
        else newT.semiFinals[sfIndex].team2 = winner;
      } else if (round === "sf") {
        if (matchIndex === 0) newT.final.team1 = winner;
        else newT.final.team2 = winner;

        if (loser) {
          if (matchIndex === 0) newT.thirdPlace.team1 = loser;
          else newT.thirdPlace.team2 = loser;
        }
      } else if (round === "final") {
        newT.champion = winner;
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ["#f59e0b", "#f97316", "#10b981", "#3b82f6", "#ec4899"] });
      } else if (round === "third") {
        newT.thirdPlaceWinner = winner;
      }

      setTournament(newT);
    },
    [tournament]
  );

  const updateKOScore = useCallback(
    (round: "qf" | "sf" | "final" | "third", matchIndex: number, slot: 1 | 2, value: string) => {
      if (!tournament) return;
      const newT = structuredClone(tournament);

      let match: KOMatch;
      if (round === "qf") match = newT.quarterFinals[matchIndex];
      else if (round === "sf") match = newT.semiFinals[matchIndex];
      else if (round === "third") match = newT.thirdPlace;
      else match = newT.final;

      if (slot === 1) match.score1 = value;
      else match.score2 = value;
      setTournament(newT);
    },
    [tournament]
  );

  const resetAll = () => {
    setConfirmAction({
      title: "Reset giải đấu?",
      message: "Xóa toàn bộ kết quả? Hành động này không thể hoàn tác.",
      action: () => {
        setTournament(createTournament(pairs, false));
        setActiveTab("groups");
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
            <div className="text-6xl opacity-50">🏆</div>
            <p className="text-lg" style={{ color: "var(--text-muted)" }}>Chưa có cặp nào! Hãy quay số trước.</p>
            <Link href="/">
              <motion.span whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 text-white font-bold shadow-lg shadow-emerald-500/25">
                Đi Quay Số
              </motion.span>
            </Link>
          </motion.div>
        </main>
      </>
    );
  }

  if (!tournament) return null;

  return (
    <>
      <Navbar />
      <main className="pt-16 sm:pt-20 pb-20 min-h-screen" style={{ background: "var(--bg-primary)" }}>

        {/* ── Hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-6 sm:pt-10 pb-4 sm:pb-6 px-4 relative"
        >
          <div className="flex items-center justify-center gap-4 mb-3 sm:mb-4">
            <div className="h-px w-12 sm:w-20" style={{ background: "linear-gradient(to right, transparent, var(--gold))" }} />
            <span className="text-xs sm:text-sm font-bold tracking-[0.35em] uppercase" style={{ color: "var(--gold)", fontFamily: "var(--font-display)" }}>
              MINI GAME
            </span>
            <div className="h-px w-12 sm:w-20" style={{ background: "linear-gradient(to left, transparent, var(--gold))" }} />
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight mt-1">
            <span style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>TRAI KHOẺ GÁI XINH</span>
          </h1>
        </motion.section>

        {/* ── Tab Selector ── */}
        <div className="flex justify-center px-4 mb-6 sm:mb-8">
          <div className="relative inline-flex rounded-xl p-1" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            {[
              { id: "groups" as TabId, label: "Vòng Bảng", icon: (
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              )},
              { id: "knockout" as TabId, label: "Vòng Loại", icon: (
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4h6v6H4zM14 4h6v6h-6zM9 10v4h6v-4M12 14v6"/></svg>
              )},
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative z-10 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors duration-200"
                style={{ color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="tabIndicator"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          {activeTab === "groups" && (
            <motion.div key="groups" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="mx-auto px-3 sm:px-6 lg:px-10 xl:px-16">

              {!groupsDrawn ? (
                <div className="max-w-2xl mx-auto">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                      <svg className="w-8 h-8 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={1.5}><path d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3"/></svg>
                    </div>
                    <p className="text-sm sm:text-base font-medium" style={{ color: "var(--text-secondary)" }}>
                      Chia <span className="font-bold" style={{ color: "var(--text-primary)" }}>{tournament.teams.length} đội</span> vào 3 bảng ngẫu nhiên
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 mb-8">
                    {tournament.teams.map((team, i) => {
                      const accent = getTeamAccent(team.seed);
                      return (
                        <motion.div
                          key={team.seed}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center gap-3 px-3.5 py-3.5 rounded-xl transition-all overflow-hidden"
                          style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderLeft: `3px solid ${accent}` }}
                        >
                          <span className="text-[10px] font-black w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: accent, color: "#fff", fontFamily: "var(--font-display)" }}>
                            {team.seed}
                          </span>
                          <TeamAvatars male={team.pair.male.image} female={team.pair.female.image} size="md" />
                          <span className="text-sm sm:text-base font-bold" style={{ color: "var(--text-primary)" }}>{team.name}</span>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="text-center">
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={randomDrawGroups}
                      className="group relative px-10 py-4 rounded-xl text-sm sm:text-base font-bold text-white shadow-xl overflow-hidden"
                      style={{ background: "linear-gradient(135deg, var(--gold-dark), var(--gold))", boxShadow: "0 8px 32px rgba(212, 168, 67, 0.3)" }}
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3"/></svg>
                        Chia bảng ngẫu nhiên
                      </span>
                    </motion.button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Scoring rules */}
                  <div className="flex justify-center mb-6 sm:mb-8">
                    {/* Scoring rules hidden */}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
                    {tournament.groups.map((group, gi) => (
                      <GroupCard
                        key={group.name}
                        group={group}
                        groupIndex={gi}
                        standings={allGroupStandings[gi] || []}
                        teamBySeed={teamBySeed}
                        updateScore={updateGroupScore}
                      />
                    ))}
                  </div>

                  {/* Chia lại + Draw QF buttons */}
                  <div className="text-center mt-8 sm:mt-10">
                    {allGroupsComplete && !tournament.qfDrawn ? (
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={drawQuarterFinals}
                        className="px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-bold text-white shadow-xl"
                        style={{ background: "linear-gradient(135deg, var(--gold-dark), var(--gold))", boxShadow: "0 8px 32px rgba(212, 168, 67, 0.3)" }}
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>
                          Bốc thăm Tứ Kết ({advancingTeams.length} đội)
                        </span>
                      </motion.button>
                    ) : !allGroupsComplete ? (
                      <p className="text-xs sm:text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                        Hoàn thành tất cả trận vòng bảng để bốc thăm tứ kết
                      </p>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-emerald-500" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        Tứ kết đã bốc thăm — chuyển sang Vòng Loại
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === "knockout" && (
            <motion.div key="knockout" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto px-3 sm:px-6">
              {!tournament.qfDrawn ? (
                <div className="text-center py-16 space-y-5">
                  <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={1.5}><path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z"/></svg>
                  </div>
                  <p className="font-medium" style={{ color: "var(--text-muted)" }}>Chưa bốc thăm tứ kết. Hoàn thành vòng bảng trước.</p>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setActiveTab("groups")}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></svg>
                    Về Vòng Bảng
                  </motion.button>
                </div>
              ) : (
                <>
                  {/* Mobile: stacked */}
                  <div className="lg:hidden space-y-8">
                    <KnockoutRoundMobile title="TỨ KẾT" subtitle="Chạm 11 — Đổi sân 6" matches={tournament.quarterFinals} round="qf" selectWinner={selectWinner} updateScore={updateKOScore} />
                    <KnockoutRoundMobile title="BÁN KẾT" subtitle="Chạm 13 — Đổi sân 6" matches={tournament.semiFinals} round="sf" selectWinner={selectWinner} updateScore={updateKOScore} />
                    <KnockoutRoundMobile title="CHUNG KẾT" subtitle="Chạm 15 — Đổi sân 8 — Cách 2 (max 19)" matches={[tournament.final]} round="final" selectWinner={selectWinner} updateScore={updateKOScore} isHighlight />
                    <KnockoutRoundMobile title="TRANH HẠNG 3" subtitle="Chạm 11 — Đổi sân 6" matches={[tournament.thirdPlace]} round="third" selectWinner={selectWinner} updateScore={updateKOScore} />
                  </div>

                  {/* Desktop: horizontal */}
                  <div className="hidden lg:block overflow-x-auto pb-8">
                    <div className="flex items-start gap-0 min-w-max py-6 px-4">
                      <KnockoutRoundDesktop title="TỨ KẾT" subtitle="Chạm 11" matches={tournament.quarterFinals} round="qf" selectWinner={selectWinner} updateScore={updateKOScore} gap="gap-5" />
                      <BracketConnector lines={4} spacing={145} />
                      <KnockoutRoundDesktop title="BÁN KẾT" subtitle="Chạm 13" matches={tournament.semiFinals} round="sf" selectWinner={selectWinner} updateScore={updateKOScore} gap="gap-[180px]" />
                      <BracketConnector lines={2} spacing={260} />
                      <div className="flex flex-col gap-12">
                        <KnockoutRoundDesktop title="CHUNG KẾT" subtitle="Chạm 15" matches={[tournament.final]} round="final" selectWinner={selectWinner} updateScore={updateKOScore} isHighlight />
                        <KnockoutRoundDesktop title="TRANH 3" subtitle="Chạm 11" matches={[tournament.thirdPlace]} round="third" selectWinner={selectWinner} updateScore={updateKOScore} />
                      </div>
                    </div>
                  </div>

                  {/* Champion + 3rd */}
                  <AnimatePresence>
                    {tournament.champion && (
                      <motion.section initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="text-center py-8 px-4">
                        <ChampionDisplay team={tournament.champion} title="VÔ ĐỊCH" rank="champion" />
                      </motion.section>
                    )}
                    {tournament.thirdPlaceWinner && (
                      <motion.section initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="text-center py-4 px-4">
                        <ChampionDisplay team={tournament.thirdPlaceWinner} title="HẠNG 3" rank="third" />
                      </motion.section>
                    )}
                    {tournament.champion && tournament.thirdPlaceWinner && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center py-4">
                        <Link href="/podium">
                          <motion.span whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/25">
                            🏆 Xem Bục Vinh Danh
                          </motion.span>
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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

/* Team accent color — each seed gets a unique stripe color */
const TEAM_ACCENT: string[] = [
  "",         // seed 0 (unused)
  "#ef4444",  // 1 red
  "#3b82f6",  // 2 blue
  "#10b981",  // 3 emerald
  "#f59e0b",  // 4 amber
  "#a855f7",  // 5 purple
  "#ec4899",  // 6 pink
  "#14b8a6",  // 7 teal
  "#f97316",  // 8 orange
  "#6366f1",  // 9 indigo
];

function getTeamAccent(seed: number) {
  return TEAM_ACCENT[seed] || "var(--text-muted)";
}

/* Reusable team avatar pair */
function TeamAvatars({ male, female, size = "md" }: { male: string; female: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "w-8 h-8 sm:w-10 sm:h-10" : size === "lg" ? "w-14 h-14 sm:w-20 sm:h-20" : "w-9 h-9 sm:w-12 sm:h-12";
  const overlap = size === "sm" ? "-space-x-1.5 sm:-space-x-2" : "-space-x-2 sm:-space-x-3";

  return (
    <div className={`flex ${overlap} shrink-0`}>
      <div className={`relative ${dims} rounded-full overflow-hidden ring-2 shadow-sm`} style={{ borderColor: "var(--male)", boxShadow: `0 0 0 2px var(--male-ring)` }}>
        <Image src={male} alt="" fill className="object-cover" />
      </div>
      <div className={`relative ${dims} rounded-full overflow-hidden ring-2 shadow-sm`} style={{ borderColor: "var(--female)", boxShadow: `0 0 0 2px var(--female-ring)` }}>
        <Image src={female} alt="" fill className="object-cover" />
      </div>
    </div>
  );
}

/* Group card with matches + standings */
function GroupCard({ group, groupIndex, standings, teamBySeed, updateScore }: {
  group: Group;
  groupIndex: number;
  standings: Standing[];
  teamBySeed: (seed: number) => Team | null;
  updateScore: (gi: number, mi: number, slot: 1 | 2, val: string) => void;
}) {
  const groupColors = [
    { accent: "#3b82f6", bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.15)" },
    { accent: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)" },
    { accent: "#10b981", bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.15)" },
  ];
  const color = groupColors[groupIndex] || groupColors[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: groupIndex * 0.12 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: `1px solid var(--border-subtle)` }}
    >
      {/* Header */}
      <div className="px-4 py-3 sm:py-3.5 flex items-center gap-3" style={{ background: color.bg, borderBottom: `1px solid ${color.border}` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-white" style={{ background: color.accent }}>
          {group.name}
        </div>
        <div>
          <div className="text-sm sm:text-base font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>
            Bảng {group.name}
          </div>
          <div className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
            {group.matches.length} trận
          </div>
        </div>
      </div>

      {/* Matches */}
      <div className="p-3 sm:p-4 space-y-2">
        {group.matches.map((match, mi) => {
          const t1 = teamBySeed(match.team1Seed);
          const t2 = teamBySeed(match.team2Seed);
          const s1 = parseInt(match.score1);
          const s2 = parseInt(match.score2);
          const hasResult = !isNaN(s1) && !isNaN(s2);
          const t1Won = hasResult && s1 > s2;
          const t2Won = hasResult && s2 > s1;

          return (
            <div key={match.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
              <GroupMatchRow team={t1} score={match.score1} isWinner={t1Won} onScoreChange={(v) => updateScore(groupIndex, mi, 1, v)} />
              <div className="h-px" style={{ background: "var(--border-subtle)" }} />
              <GroupMatchRow team={t2} score={match.score2} isWinner={t2Won} onScoreChange={(v) => updateScore(groupIndex, mi, 2, v)} />
            </div>
          );
        })}
      </div>

      {/* Standings table */}
      <div className="px-3 sm:px-4 pb-3 sm:pb-4">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2 pl-1" style={{ color: "var(--text-muted)" }}>
          Bảng xếp hạng
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
          <table className="w-full text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
            <thead>
              <tr style={{ background: "var(--bg-hover)" }}>
                <th className="text-left py-2.5 pl-3 w-6 font-semibold" style={{ color: "var(--text-muted)" }}>#</th>
                <th className="text-left py-2.5 font-semibold" style={{ color: "var(--text-muted)" }}>Đội</th>
                <th className="text-center py-2.5 font-semibold" style={{ color: "var(--text-muted)", width: 76 }}>Thắng</th>
                <th className="text-center py-2.5 font-semibold" style={{ color: "var(--text-muted)", width: 76 }}>Thua</th>
                <th className="text-center py-2.5 pr-3 font-semibold" style={{ color: "var(--text-muted)", width: 76 }}>HS</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((st, rank) => {
                const isQualified = rank < 2;
                const accent = getTeamAccent(st.team.seed);
                return (
                  <tr
                    key={st.team.seed}
                    className="transition-all"
                    style={{ borderTop: "1px solid var(--border-subtle)", background: isQualified ? "rgba(16,185,129,0.06)" : "transparent" }}
                  >
                    <td className="py-2.5 pl-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
                        <span className={`text-xs font-bold ${isQualified ? "text-emerald-500" : ""}`} style={!isQualified ? { color: "var(--text-muted)" } : undefined}>
                          {rank + 1}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <TeamAvatars male={st.team.pair.male.image} female={st.team.pair.female.image} size="sm" />
                        <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{st.team.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-2.5 font-bold text-emerald-500">{st.won}</td>
                    <td className="text-center py-2.5" style={{ color: st.lost > 0 ? "#ef4444" : "var(--text-muted)" }}>{st.lost}</td>
                    <td className="text-center py-2.5 pr-3 font-bold" style={{ fontFamily: "var(--font-display)", fontSize: "11px", color: st.diff > 0 ? "#10b981" : st.diff < 0 ? "#ef4444" : "var(--text-muted)" }}>
                      {st.diff > 0 ? `+${st.diff}` : st.diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

/* Group match row */
function GroupMatchRow({ team, score, isWinner, onScoreChange }: {
  team: Team | null;
  score: string;
  isWinner: boolean;
  onScoreChange: (val: string) => void;
}) {
  if (!team) return <div className="px-3 py-3 opacity-30 text-sm" style={{ color: "var(--text-muted)" }}>—</div>;
  const accent = getTeamAccent(team.seed);
  return (
    <div
      className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-4 py-2.5 sm:py-3.5 transition-all"
      style={{ background: isWinner ? "rgba(16,185,129,0.08)" : "transparent" }}
    >
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: accent }} />
      <TeamAvatars male={team.pair.male.image} female={team.pair.female.image} size="md" />
      <span className="text-xs sm:text-base font-bold flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{team.name}</span>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <input
          type="text"
          inputMode="numeric"
          value={score}
          placeholder="–"
          maxLength={2}
          onChange={(e) => onScoreChange(e.target.value.replace(/\D/g, ""))}
          className="w-9 sm:w-11 text-center text-xs sm:text-sm font-bold rounded-lg py-1 sm:py-1.5 outline-none transition-all"
          style={{
            color: score ? "var(--text-primary)" : "var(--text-muted)",
            background: "var(--bg-hover)",
            border: "1px solid var(--border-subtle)",
            fontFamily: "var(--font-display)",
          }}
        />
        {isWinner && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7"/></svg>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* Knockout round - mobile */
function KnockoutRoundMobile({ title, subtitle, matches, round, selectWinner, updateScore, isHighlight = false }: {
  title: string;
  subtitle: string;
  matches: KOMatch[];
  round: "qf" | "sf" | "final" | "third";
  selectWinner: (round: "qf" | "sf" | "final" | "third", idx: number, slot: 1 | 2) => void;
  updateScore: (round: "qf" | "sf" | "final" | "third", idx: number, slot: 1 | 2, val: string) => void;
  isHighlight?: boolean;
}) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
        <div className="text-center">
          <div
            className="text-[10px] sm:text-xs font-black tracking-[0.2em] uppercase px-4 py-1.5 rounded-lg"
            style={isHighlight
              ? { background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(249,115,22,0.12))", color: "var(--gold)", border: "1px solid rgba(245,158,11,0.2)" }
              : { background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }
            }
          >
            {title}
          </div>
        </div>
        <div className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
      </div>
      <p className="text-center text-[10px] mb-3 font-medium" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      <div className="space-y-3">
        {matches.map((match, idx) => (
          <KOMatchCard key={match.id} match={match} round={round} matchIndex={idx} selectWinner={selectWinner} updateScore={updateScore} isHighlight={isHighlight} label={getKOLabel(round, idx)} />
        ))}
      </div>
    </div>
  );
}

/* Knockout round - desktop */
function KnockoutRoundDesktop({ title, subtitle, matches, round, selectWinner, updateScore, gap = "gap-8", isHighlight = false }: {
  title: string;
  subtitle: string;
  matches: KOMatch[];
  round: "qf" | "sf" | "final" | "third";
  selectWinner: (round: "qf" | "sf" | "final" | "third", idx: number, slot: 1 | 2) => void;
  updateScore: (round: "qf" | "sf" | "final" | "third", idx: number, slot: 1 | 2, val: string) => void;
  gap?: string;
  isHighlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center min-w-[330px]">
      <div
        className="text-xs font-black tracking-[0.2em] uppercase mb-1 px-4 py-1.5 rounded-lg"
        style={isHighlight
          ? { background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(249,115,22,0.12))", color: "var(--gold)", border: "1px solid rgba(245,158,11,0.2)" }
          : { background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }
        }
      >
        {title}
      </div>
      <p className="text-[10px] mb-4 font-medium" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      <div className={`flex flex-col ${gap} justify-center`}>
        {matches.map((match, idx) => (
          <KOMatchCard key={match.id} match={match} round={round} matchIndex={idx} selectWinner={selectWinner} updateScore={updateScore} isHighlight={isHighlight} label={getKOLabel(round, idx)} />
        ))}
      </div>
    </div>
  );
}

/* Knockout match card */
function KOMatchCard({ match, round, matchIndex, selectWinner, updateScore, isHighlight, label }: {
  match: KOMatch;
  round: "qf" | "sf" | "final" | "third";
  matchIndex: number;
  selectWinner: (round: "qf" | "sf" | "final" | "third", idx: number, slot: 1 | 2) => void;
  updateScore: (round: "qf" | "sf" | "final" | "third", idx: number, slot: 1 | 2, val: string) => void;
  isHighlight: boolean;
  label: string;
}) {
  const hasWinner = !!match.winner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden w-full lg:w-[330px] transition-all"
      style={{
        background: "var(--bg-card)",
        border: isHighlight && hasWinner ? "2px solid var(--gold)" : "1px solid var(--border-subtle)",
        boxShadow: isHighlight && hasWinner ? "0 4px 24px rgba(212,168,67,0.15)" : "var(--shadow-card)",
      }}
    >
      {/* Match label */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-subtle)" }}>
        <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: "var(--text-muted)" }}>{label}</span>
        {hasWinner && (
          <span className="text-[9px] font-bold tracking-wider uppercase text-emerald-500">Kết thúc</span>
        )}
      </div>
      <KOTeamRow team={match.team1} score={match.score1} isWinner={match.winner?.seed === match.team1?.seed}
        onClick={() => selectWinner(round, matchIndex, 1)} onScoreChange={(v) => updateScore(round, matchIndex, 1, v)} />
      <div className="h-px mx-3" style={{ background: "var(--border-subtle)" }} />
      <KOTeamRow team={match.team2} score={match.score2} isWinner={match.winner?.seed === match.team2?.seed}
        onClick={() => selectWinner(round, matchIndex, 2)} onScoreChange={(v) => updateScore(round, matchIndex, 2, v)} />
    </motion.div>
  );
}

/* Team row in knockout match */
function KOTeamRow({ team, score, isWinner, onClick, onScoreChange }: {
  team: Team | null;
  score: string;
  isWinner: boolean;
  onClick: () => void;
  onScoreChange: (val: string) => void;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-3.5">
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: "var(--border-subtle)" }} />
        <div className="flex -space-x-2">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full" style={{ background: "var(--bg-hover)", border: "2px dashed var(--border-subtle)" }} />
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full" style={{ background: "var(--bg-hover)", border: "2px dashed var(--border-subtle)" }} />
        </div>
        <span className="text-xs italic font-medium" style={{ color: "var(--text-muted)" }}>Chờ kết quả...</span>
      </div>
    );
  }

  const accent = getTeamAccent(team.seed);
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-3 sm:py-3.5 cursor-pointer transition-all group"
      style={{ background: isWinner ? "rgba(16,185,129,0.08)" : "transparent" }}
      onClick={onClick}
      title="Click chọn đội thắng"
    >
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: accent }} />
      <TeamAvatars male={team.pair.male.image} female={team.pair.female.image} size="md" />
      <span className="text-xs sm:text-sm font-bold flex-1" style={{ color: isWinner ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {team.name}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          value={score}
          placeholder="–"
          maxLength={3}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onScoreChange(e.target.value.replace(/\D/g, ""))}
          className="w-9 sm:w-10 text-center text-xs font-bold rounded-lg py-1.5 outline-none transition-all"
          style={{
            color: score ? "var(--text-primary)" : "var(--text-muted)",
            background: "var(--bg-hover)",
            border: "1px solid var(--border-subtle)",
            fontFamily: "var(--font-display)",
          }}
        />
        {isWinner && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7"/></svg>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* Champion display */
function ChampionDisplay({ team, title, rank }: { team: Team; title: string; rank: "champion" | "third" }) {
  const isChampion = rank === "champion";

  return (
    <motion.div
      className="inline-flex flex-col items-center gap-4 rounded-2xl p-6 sm:p-8 relative overflow-hidden"
      style={{
        background: "var(--bg-card)",
        border: isChampion ? "2px solid var(--gold)" : "1px solid var(--border-subtle)",
        boxShadow: isChampion ? "0 8px 40px rgba(212,168,67,0.2), 0 0 80px rgba(212,168,67,0.05)" : "var(--shadow-card)",
      }}
    >
      {/* Subtle glow behind champion */}
      {isChampion && (
        <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 50% 30%, var(--gold), transparent 70%)" }} />
      )}

      <div className="relative z-10 flex flex-col items-center gap-3">
        {/* Title badge */}
        <div className="flex items-center gap-2">
          {isChampion && <span className="text-2xl sm:text-3xl animate-crown">👑</span>}
          <span
            className="text-xs sm:text-sm font-black tracking-[0.35em] uppercase"
            style={{
              color: isChampion ? "var(--gold)" : "var(--text-muted)",
              fontFamily: "var(--font-display)",
            }}
          >
            {title}
          </span>
          {isChampion && <span className="text-2xl sm:text-3xl animate-crown">👑</span>}
        </div>

        {/* Player display */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`relative ${isChampion ? "w-16 h-16 sm:w-20 sm:h-20" : "w-12 h-12 sm:w-14 sm:h-14"} rounded-full overflow-hidden shadow-lg`}
              style={{ boxShadow: isChampion ? `0 0 0 3px var(--gold), 0 4px 20px rgba(212,168,67,0.3)` : `0 0 0 2px var(--border-subtle)` }}
            >
              <Image src={team.pair.male.image} alt="" fill className="object-cover" />
            </div>
            <span className="font-bold text-[10px] sm:text-xs" style={{ color: "var(--text-primary)" }}>{team.pair.male.displayName}</span>
          </div>

          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-[10px] sm:text-xs"
            style={{
              background: isChampion ? "linear-gradient(135deg, var(--gold-dark), var(--gold))" : "var(--bg-hover)",
              color: isChampion ? "white" : "var(--text-muted)",
              border: isChampion ? "none" : "1px solid var(--border-subtle)",
            }}
          >
            &amp;
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`relative ${isChampion ? "w-16 h-16 sm:w-20 sm:h-20" : "w-12 h-12 sm:w-14 sm:h-14"} rounded-full overflow-hidden shadow-lg`}
              style={{ boxShadow: isChampion ? `0 0 0 3px var(--gold), 0 4px 20px rgba(212,168,67,0.3)` : `0 0 0 2px var(--border-subtle)` }}
            >
              <Image src={team.pair.female.image} alt="" fill className="object-cover" />
            </div>
            <span className="font-bold text-[10px] sm:text-xs" style={{ color: "var(--text-primary)" }}>{team.pair.female.displayName}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* Desktop bracket connector lines via SVG */
function BracketConnector({ lines, spacing }: { lines: number; spacing: number }) {
  const pairs = lines / 2;
  const svgHeight = pairs * spacing + (pairs - 1) * spacing;
  const midX = 20;

  return (
    <div className="flex items-center" style={{ width: 40, height: svgHeight }}>
      <svg width="40" height={svgHeight} className="overflow-visible">
        {Array.from({ length: pairs }).map((_, i) => {
          const topY = i * spacing * 2 + spacing / 2;
          const bottomY = topY + spacing;
          const midY = (topY + bottomY) / 2;
          return (
            <g key={i}>
              {/* Top line to mid */}
              <line x1="0" y1={topY} x2={midX} y2={topY} stroke="var(--border-subtle)" strokeWidth="2" />
              <line x1={midX} y1={topY} x2={midX} y2={bottomY} stroke="var(--border-subtle)" strokeWidth="2" />
              <line x1="0" y1={bottomY} x2={midX} y2={bottomY} stroke="var(--border-subtle)" strokeWidth="2" />
              {/* Output to next round */}
              <line x1={midX} y1={midY} x2="40" y2={midY} stroke="var(--border-subtle)" strokeWidth="2" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function getKOLabel(round: "qf" | "sf" | "final" | "third", idx: number) {
  if (round === "qf") return `Tứ Kết ${idx + 1}`;
  if (round === "sf") return `Bán Kết ${idx + 1}`;
  if (round === "final") return "Chung Kết";
  return "Tranh Hạng 3";
}

/* ======== HELPERS ======== */

function createTournament(pairs: Pair[], withGroups = true): TournamentState {
  const teams: Team[] = pairs.map((pair, i) => ({
    seed: i + 1,
    pair,
    name: getTeamName(pair),
  }));

  const groups: Group[] = [];

  if (withGroups) {
    const numGroups = Math.ceil(teams.length / 3);
    const groupNames = ["A", "B", "C", "D", "E", "F"];

    for (let g = 0; g < numGroups; g++) {
      const groupTeams = teams.slice(g * 3, g * 3 + 3);
      const seeds = groupTeams.map((t) => t.seed);
      const matches: GroupMatch[] = [];

      for (let i = 0; i < seeds.length; i++) {
        for (let j = i + 1; j < seeds.length; j++) {
          matches.push({ id: `g${g}-m${matches.length}`, team1Seed: seeds[i], team2Seed: seeds[j], score1: "", score2: "" });
        }
      }

      groups.push({ name: groupNames[g] || `${g + 1}`, teamSeeds: seeds, matches });
    }
  }

  return {
    teams,
    groups,
    quarterFinals: Array.from({ length: 4 }, (_, i) => ({
      id: `qf${i + 1}`,
      team1: null, team2: null, score1: "", score2: "", winner: null,
    })),
    semiFinals: Array.from({ length: 2 }, (_, i) => ({
      id: `sf${i + 1}`,
      team1: null, team2: null, score1: "", score2: "", winner: null,
    })),
    final: { id: "final", team1: null, team2: null, score1: "", score2: "", winner: null },
    thirdPlace: { id: "third", team1: null, team2: null, score1: "", score2: "", winner: null },
    champion: null,
    thirdPlaceWinner: null,
    qfDrawn: false,
  };
}

function fixPairImages(pairs: Pair[]): Pair[] {
  return pairs.map((p) => ({
    male: { ...p.male, image: p.male.image.startsWith("/") ? p.male.image : `/${p.male.image}` },
    female: { ...p.female, image: p.female.image.startsWith("/") ? p.female.image : `/${p.female.image}` },
  }));
}

function fixTeamImagePaths(team: Team | null) {
  if (!team) return;
  if (!team.pair.male.image.startsWith("/")) team.pair.male.image = `/${team.pair.male.image}`;
  if (!team.pair.female.image.startsWith("/")) team.pair.female.image = `/${team.pair.female.image}`;
}

function fixAllImagePaths(t: TournamentState) {
  t.teams.forEach((tt) => fixTeamImagePaths(tt));
  t.groups.forEach((g) => {
    g.teamSeeds.forEach((seed) => {
      const team = t.teams.find((tt) => tt.seed === seed);
      if (team) fixTeamImagePaths(team);
    });
  });
  t.quarterFinals.forEach((m) => { fixTeamImagePaths(m.team1); fixTeamImagePaths(m.team2); fixTeamImagePaths(m.winner); });
  t.semiFinals.forEach((m) => { fixTeamImagePaths(m.team1); fixTeamImagePaths(m.team2); fixTeamImagePaths(m.winner); });
  fixTeamImagePaths(t.final.team1); fixTeamImagePaths(t.final.team2); fixTeamImagePaths(t.final.winner);
  fixTeamImagePaths(t.thirdPlace.team1); fixTeamImagePaths(t.thirdPlace.team2); fixTeamImagePaths(t.thirdPlace.winner);
  fixTeamImagePaths(t.champion);
  fixTeamImagePaths(t.thirdPlaceWinner);
}
