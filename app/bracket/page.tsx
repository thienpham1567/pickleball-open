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
            // Create tournament without groups - wait for manual draw
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

    // Sort 3rd place teams
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
      title: "🎲 Chia bảng ngẫu nhiên?",
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
      title: "🎲 Bốc thăm tứ kết?",
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
        // QF0,QF1 → SF0; QF2,QF3 → SF1
        const sfIndex = matchIndex < 2 ? 0 : 1;
        const sfSlot = matchIndex % 2 === 0 ? 1 : 2;
        if (sfSlot === 1) newT.semiFinals[sfIndex].team1 = winner;
        else newT.semiFinals[sfIndex].team2 = winner;
      } else if (round === "sf") {
        if (matchIndex === 0) newT.final.team1 = winner;
        else newT.final.team2 = winner;

        // Losers go to 3rd place match
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
      title: "🗑️ Reset giải đấu?",
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
            <p className="text-lg text-slate-500">Chưa có cặp nào! Hãy quay số trước.</p>
            <Link href="/">
              <motion.span whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 text-white font-bold shadow-lg shadow-emerald-500/25">
                🏓 Đi Quay Số
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
      <main className="pt-16 sm:pt-20 pb-16 min-h-screen" style={{ background: "var(--bg-primary)" }}>
        {/* Hero */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-5 sm:py-8 px-4">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight">
            <span className="text-shimmer">PICKLEBALL TÂN PHÚ OPEN</span>
          </h1>
          <p className="text-sm sm:text-base mt-1.5 sm:mt-2" style={{ color: "var(--text-muted)" }}>
            {tournament.teams.length} đội — Vòng tròn tính điểm → Tứ kết → Chung kết
          </p>
        </motion.section>

        {/* Tabs */}
        <div className="flex justify-center gap-2 px-4 mb-6">
          {[
            { id: "groups" as TabId, label: "📋 Vòng Bảng", emoji: "" },
            { id: "knockout" as TabId, label: "⚔️ Vòng Loại", emoji: "" },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25"
                  : "glass-card"
              }`}
              style={activeTab !== tab.id ? { color: "var(--text-secondary)" } : undefined}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "groups" && (
            <motion.div key="groups" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="max-w-5xl mx-auto px-3 sm:px-6">

              {!groupsDrawn ? (
                /* Teams list + draw button (before groups are assigned) */
                <div className="max-w-2xl mx-auto">
                  <div className="text-center mb-6">
                    <div className="text-5xl mb-4 opacity-60">🎲</div>
                    <p className="text-sm sm:text-base" style={{ color: "var(--text-muted)" }}>
                      Bấm nút bên dưới để chia {tournament.teams.length} đội vào 3 bảng ngẫu nhiên
                    </p>
                  </div>

                  {/* Team grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                    {tournament.teams.map((team, i) => (
                      <motion.div
                        key={team.seed}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="glass-card rounded-xl p-3 flex items-center gap-2.5"
                      >
                        <span className="text-xs font-bold w-6 text-center" style={{ color: "var(--text-muted)" }}>{team.seed}</span>
                        <div className="flex -space-x-2">
                          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-blue-300">
                            <Image src={team.pair.male.image} alt="" fill className="object-cover" />
                          </div>
                          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-pink-300">
                            <Image src={team.pair.female.image} alt="" fill className="object-cover" />
                          </div>
                        </div>
                        <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{team.name}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Draw button */}
                  <div className="text-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={randomDrawGroups}
                      className="px-10 py-4 rounded-full text-base sm:text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-xl shadow-blue-500/30"
                    >
                      🎲 Chia bảng ngẫu nhiên
                    </motion.button>
                  </div>
                </div>
              ) : (
                /* Groups with matches + standings (after draw) */
                <>
                  {/* Scoring rules + re-draw */}
                  <div className="flex justify-center items-center gap-3 mb-6 flex-wrap">
                    <div className="px-4 py-2.5 rounded-xl glass-card inline-flex gap-4 text-[10px] sm:text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>🏓 Chạm <b>11</b> điểm</span>
                      <span>🔄 Đổi sân <b>6</b> điểm</span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={randomDrawGroups}
                      className="px-4 py-2 rounded-full text-xs font-semibold glass-card transition-all"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      🔀 Chia lại bảng
                    </motion.button>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
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
                  <div className="text-center mt-8 space-y-3">
                    {allGroupsComplete && !tournament.qfDrawn ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={drawQuarterFinals}
                        className="px-8 py-3.5 rounded-full text-sm sm:text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/30"
                      >
                        🎲 Bốc thăm Tứ Kết ({advancingTeams.length} đội)
                      </motion.button>
                    ) : !allGroupsComplete ? (
                      <p className="text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
                        Hoàn thành tất cả trận vòng bảng để bốc thăm tứ kết
                      </p>
                    ) : (
                      <p className="text-xs sm:text-sm text-emerald-500 font-medium">
                        ✅ Tứ kết đã được bốc thăm — chuyển sang tab Vòng Loại
                      </p>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={randomDrawGroups}
                      className="px-5 py-2 rounded-full text-xs font-semibold glass-card transition-all"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      🔀 Chia lại bảng
                    </motion.button>
                  </div>
                </>
              )}

            </motion.div>
          )}

          {activeTab === "knockout" && (
            <motion.div key="knockout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-6xl mx-auto px-3 sm:px-6">
              {!tournament.qfDrawn ? (
                <div className="text-center py-16 space-y-4">
                  <div className="text-5xl opacity-40">⚔️</div>
                  <p style={{ color: "var(--text-muted)" }}>Chưa bốc thăm tứ kết. Hoàn thành vòng bảng trước.</p>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setActiveTab("groups")} className="px-6 py-2.5 rounded-full text-sm font-bold glass-card" style={{ color: "var(--text-secondary)" }}>
                    ← Về Vòng Bảng
                  </motion.button>
                </div>
              ) : (
                <>
                  {/* Mobile: stacked */}
                  <div className="lg:hidden space-y-8">
                    <KnockoutRoundMobile title="TỨ KẾT" subtitle="Chạm 11 • Đổi sân 6" matches={tournament.quarterFinals} round="qf" selectWinner={selectWinner} updateScore={updateKOScore} />
                    <KnockoutRoundMobile title="BÁN KẾT" subtitle="Chạm 13 • Đổi sân 6" matches={tournament.semiFinals} round="sf" selectWinner={selectWinner} updateScore={updateKOScore} />
                    <KnockoutRoundMobile title="🏆 CHUNG KẾT" subtitle="Chạm 15 • Đổi sân 8 • Cách 2 (max 19)" matches={[tournament.final]} round="final" selectWinner={selectWinner} updateScore={updateKOScore} isHighlight />
                    <KnockoutRoundMobile title="🥉 TRANH 3" subtitle="Chạm 11 • Đổi sân 6" matches={[tournament.thirdPlace]} round="third" selectWinner={selectWinner} updateScore={updateKOScore} />
                  </div>

                  {/* Desktop: horizontal */}
                  <div className="hidden lg:block overflow-x-auto pb-8">
                    <div className="flex items-start gap-0 min-w-max py-6 px-4">
                      <KnockoutRoundDesktop title="TỨ KẾT" subtitle="Chạm 11" matches={tournament.quarterFinals} round="qf" selectWinner={selectWinner} updateScore={updateKOScore} gap="gap-5" />
                      <Connector height={145} />
                      <KnockoutRoundDesktop title="BÁN KẾT" subtitle="Chạm 13" matches={tournament.semiFinals} round="sf" selectWinner={selectWinner} updateScore={updateKOScore} gap="gap-[180px]" />
                      <Connector height={260} />
                      <div className="flex flex-col gap-12">
                        <KnockoutRoundDesktop title="🏆 CHUNG KẾT" subtitle="Chạm 15" matches={[tournament.final]} round="final" selectWinner={selectWinner} updateScore={updateKOScore} isHighlight />
                        <KnockoutRoundDesktop title="🥉 TRANH 3" subtitle="Chạm 11" matches={[tournament.thirdPlace]} round="third" selectWinner={selectWinner} updateScore={updateKOScore} />
                      </div>
                    </div>
                  </div>

                  {/* Champion + 3rd */}
                  <AnimatePresence>
                    {tournament.champion && (
                      <motion.section initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 px-4">
                        <ChampionDisplay team={tournament.champion} title="VÔ ĐỊCH" icon="👑" ringColor="ring-amber-400" />
                      </motion.section>
                    )}
                    {tournament.thirdPlaceWinner && (
                      <motion.section initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4 px-4">
                        <ChampionDisplay team={tournament.thirdPlaceWinner} title="HẠNG 3" icon="🥉" ringColor="ring-emerald-400" />
                      </motion.section>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex justify-center gap-2 sm:gap-3 py-6 flex-wrap px-4 sm:px-6">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => window.print()} className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold glass-card transition-all" style={{ color: "var(--text-secondary)" }}>
            🖨️ In
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={resetAll} className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all hover:text-red-500" style={{ color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
            🗑️ Reset giải
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

/* Group card with matches + standings */
function GroupCard({ group, groupIndex, standings, teamBySeed, updateScore }: {
  group: Group;
  groupIndex: number;
  standings: Standing[];
  teamBySeed: (seed: number) => Team | null;
  updateScore: (gi: number, mi: number, slot: 1 | 2, val: string) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: groupIndex * 0.15 }} className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 text-center font-black text-base sm:text-lg tracking-[0.2em] uppercase" style={{ background: "var(--bg-hover)", color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)" }}>
        BẢNG {group.name}
      </div>

      {/* Matches */}
      <div className="p-3 sm:p-4 space-y-2.5">
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
        <table className="w-full text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <th className="text-left py-2 pl-2">#</th>
              <th className="text-left py-2">Đội</th>
              <th className="text-center py-2 w-7">T</th>
              <th className="text-center py-2 w-7">W</th>
              <th className="text-center py-2 w-7">L</th>
              <th className="text-center py-2 w-10">+/-</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((st, rank) => (
              <tr key={st.team.seed} className={`border-b transition-all ${rank < 2 ? "bg-emerald-500/5" : ""}`} style={{ borderColor: "var(--border-subtle)" }}>
                <td className="py-2 pl-2 font-bold">
                  {rank < 2 ? (
                    <span className="text-emerald-500">{rank + 1}</span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>{rank + 1}</span>
                  )}
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      <div className="relative w-7 h-7 rounded-full overflow-hidden ring-1 ring-blue-300">
                        <Image src={st.team.pair.male.image} alt="" fill className="object-cover" />
                      </div>
                      <div className="relative w-7 h-7 rounded-full overflow-hidden ring-1 ring-pink-300">
                        <Image src={st.team.pair.female.image} alt="" fill className="object-cover" />
                      </div>
                    </div>
                    <span className="truncate font-medium" style={{ color: "var(--text-primary)", maxWidth: "120px" }}>{st.team.name}</span>
                  </div>
                </td>
                <td className="text-center py-2">{st.played}</td>
                <td className="text-center py-2 font-bold text-emerald-500">{st.won}</td>
                <td className="text-center py-2">{st.lost}</td>
                <td className="text-center py-2 font-mono font-bold" style={{ color: st.diff > 0 ? "#10b981" : st.diff < 0 ? "#ef4444" : "var(--text-muted)" }}>
                  {st.diff > 0 ? `+${st.diff}` : st.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  return (
    <div className={`flex items-center gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 transition-all ${isWinner ? "bg-emerald-500/10" : ""}`}>
      <div className="flex -space-x-1.5">
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden ring-2 ring-blue-300">
          <Image src={team.pair.male.image} alt="" fill className="object-cover" />
        </div>
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden ring-2 ring-pink-300">
          <Image src={team.pair.female.image} alt="" fill className="object-cover" />
        </div>
      </div>
      <span className="text-xs sm:text-sm font-semibold flex-1 truncate" style={{ color: "var(--text-primary)" }}>{team.name}</span>
      <input
        type="text"
        inputMode="numeric"
        value={score}
        placeholder="-"
        maxLength={2}
        onChange={(e) => onScoreChange(e.target.value.replace(/\D/g, ""))}
        className="w-10 sm:w-11 text-center text-sm font-bold rounded-md py-1.5 outline-none transition-all"
        style={{ color: "var(--gold-dark)", background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
      />
      {isWinner && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-500 font-bold text-sm">✓</motion.span>}
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
      <div className="text-center mb-3">
        <div className={`inline-flex text-[10px] sm:text-xs font-bold tracking-[0.15em] uppercase px-4 py-1.5 rounded-full ${isHighlight ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600" : ""}`} style={!isHighlight ? { background: "var(--bg-hover)", color: "var(--text-muted)" } : undefined}>
          {title}
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      </div>
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
    <div className="flex flex-col items-center min-w-[280px]">
      <div className={`text-xs font-bold tracking-[0.2em] uppercase mb-1 px-4 py-1.5 rounded-full ${isHighlight ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 border border-amber-200" : ""}`} style={!isHighlight ? { background: "var(--bg-hover)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" } : undefined}>
        {title}
      </div>
      <p className="text-[10px] mb-4" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
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
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02 }}
      className={`glass-card rounded-xl overflow-hidden w-full lg:w-[275px] transition-all ${isHighlight && match.winner ? "shadow-lg" : "hover:shadow-lg"}`}
      style={isHighlight && match.winner ? { border: "2px solid var(--gold)", boxShadow: "0 4px 20px rgba(245,158,11,0.15)" } : undefined}
    >
      <div className="text-[10px] font-bold tracking-[0.15em] text-center py-1.5 uppercase border-b" style={{ color: "var(--text-muted)", background: "var(--bg-hover)", borderColor: "var(--border-subtle)" }}>
        {label}
      </div>
      <KOTeamRow team={match.team1} score={match.score1} isWinner={match.winner?.seed === match.team1?.seed}
        onClick={() => selectWinner(round, matchIndex, 1)} onScoreChange={(v) => updateScore(round, matchIndex, 1, v)} />
      <div className="h-px" style={{ background: "var(--border-subtle)" }} />
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
      <div className="flex items-center gap-2 px-3 py-3 opacity-30">
        <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>Chờ kết quả...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all ${isWinner ? "bg-emerald-500/10" : ""}`} onClick={onClick} title="Click chọn đội thắng">
      <span className="text-[10px] font-bold w-5 text-center" style={{ color: "var(--text-muted)" }}>{team.seed}</span>
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
        inputMode="numeric"
        value={score}
        placeholder="-"
        maxLength={3}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onScoreChange(e.target.value.replace(/\D/g, ""))}
        className="w-9 sm:w-10 text-center text-xs font-bold rounded-md py-1 outline-none transition-all"
        style={{ color: "var(--gold-dark)", background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
      />
      {isWinner && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-500 font-bold text-xs">✓</motion.span>}
    </div>
  );
}

/* Champion display */
function ChampionDisplay({ team, title, icon, ringColor }: { team: Team; title: string; icon: string; ringColor: string }) {
  return (
    <div className="inline-flex flex-col items-center gap-3 glass-card rounded-3xl p-5 sm:p-6 shadow-xl" style={{ border: "2px solid var(--gold)" }}>
      <div className="text-3xl sm:text-4xl">{icon}</div>
      <h2 className="text-sm sm:text-base font-black tracking-[0.3em] bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">{title}</h2>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden ring-3 ${ringColor} shadow-lg`}>
            <Image src={team.pair.male.image} alt="" fill className="object-cover" />
          </div>
          <span className="font-bold text-[10px] sm:text-xs" style={{ color: "var(--text-primary)" }}>{team.pair.male.displayName}</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow">
          <span className="text-white font-black text-[10px]">&</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden ring-3 ${ringColor} shadow-lg`}>
            <Image src={team.pair.female.image} alt="" fill className="object-cover" />
          </div>
          <span className="font-bold text-[10px] sm:text-xs" style={{ color: "var(--text-primary)" }}>{team.pair.female.displayName}</span>
        </div>
      </div>
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
    // Divide into groups of 3
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
