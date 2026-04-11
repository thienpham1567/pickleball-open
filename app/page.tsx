"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import confetti from "canvas-confetti";
import Navbar from "@/components/Navbar";
import SpinningWheel from "@/components/SpinningWheel";
import PairResultModal from "@/components/PairResultModal";
import PairCard from "@/components/PairCard";
import ConfirmModal from "@/components/ConfirmModal";
import {
  malePlayers as fallbackMales,
  femalePlayers as fallbackFemales,
  type Player,
  type Pair,
} from "@/lib/players";
import {
  fetchPlayers,
  fetchPairs,
  savePairs,
  resetTournament,
  subscribeTournamentData,
} from "@/lib/supabase-data";

type SpinMode = "dual" | "pick";

// Predetermined pair mappings: male ID → female ID
const PREDETERMINED_PAIRS: Record<string, string> = {
  "a-bao": "c-truc", // a Dũng Lớn - c Trúc
  "a-phap": "c-quynh", // a Pháp - c Quỳnh
  "a-thin": "c-me", // a Thìn - Trẻ nhất
  "a-duy": "c-kieu", // a Duy - c Kiều
  "a-dung": "c-thao", // a Dũng nhỏ - c Ngô Thảo
  "a-dung-gia": "c-thanh-thao", // a Bảo - c Thanh Thảo
  "a-tuyen": "c-thu", // a Tuyến - c Thu Julie
};

// Reverse map: female ID → male ID
const FEMALE_TO_MALE: Record<string, string> = Object.fromEntries(
  Object.entries(PREDETERMINED_PAIRS).map(([m, f]) => [f, m]),
);

function useWheelSize(mode: SpinMode) {
  const [sizes, setSizes] = useState({ dual: 360, pick: 400 });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480) {
        const mobileSize = Math.min(w - 24, 320);
        setSizes({ dual: mobileSize, pick: mobileSize });
      } else if (w < 640) {
        const mobileSize = Math.min(w - 32, 360);
        setSizes({ dual: mobileSize, pick: mobileSize });
      } else if (w < 1024) {
        setSizes({ dual: 340, pick: 380 });
      } else {
        setSizes({ dual: 400, pick: 440 });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return mode === "dual" ? sizes.dual : sizes.pick;
}

export default function SpinPage() {
  const [malePlayers, setMalePlayers] = useState<Player[]>(fallbackMales);
  const [femalePlayers, setFemalePlayers] = useState<Player[]>(fallbackFemales);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [pendingMale, setPendingMale] = useState<Player | null>(null);
  const [pendingFemale, setPendingFemale] = useState<Player | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastPair, setLastPair] = useState<Pair | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [mode, setMode] = useState<SpinMode>("pick");
  const [selectedFemale, setSelectedFemale] = useState<Player | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [targetMaleId, setTargetMaleId] = useState<string | undefined>();
  const [targetFemaleId, setTargetFemaleId] = useState<string | undefined>();
  const wheelSize = useWheelSize(mode);

  // Countdown lock — unlock at 18:00 today
  const UNLOCK_HOUR = 18; // 6 PM
  const [countdown, setCountdown] = useState("");
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const unlock = new Date();
      unlock.setHours(UNLOCK_HOUR, 0, 0, 0);

      if (now >= unlock) {
        setIsLocked(false);
        setCountdown("");
        return;
      }

      const diff = unlock.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
      setIsLocked(true);
    };

    checkTime();
    const timer = setInterval(checkTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalPairs = Math.min(malePlayers.length, femalePlayers.length);

  // Load players and pairs from Supabase (with localStorage fallback)
  useEffect(() => {
    async function loadData() {
      try {
        // Load players from Supabase
        const { males, females } = await fetchPlayers();
        if (males.length > 0) setMalePlayers(males);
        if (females.length > 0) setFemalePlayers(females);

        // Load pairs from Supabase
        const dbPairs = await fetchPairs();
        if (dbPairs.length > 0) {
          setPairs(dbPairs);
        } else {
          // Fallback: try localStorage
          const saved = localStorage.getItem("pickleball-pairs");
          if (saved) {
            try {
              const parsed: Pair[] = JSON.parse(saved);
              const fixed = parsed.map((p) => ({
                male: {
                  ...p.male,
                  image: p.male.image.startsWith("/")
                    ? p.male.image
                    : `/${p.male.image}`,
                },
                female: {
                  ...p.female,
                  image: p.female.image.startsWith("/")
                    ? p.female.image
                    : `/${p.female.image}`,
                },
              }));
              setPairs(fixed);
            } catch {
              localStorage.removeItem("pickleball-pairs");
            }
          }
        }
      } catch (err) {
        console.warn("Supabase unavailable, using local data:", err);
        // Fallback to localStorage
        const saved = localStorage.getItem("pickleball-pairs");
        if (saved) {
          try {
            setPairs(JSON.parse(saved));
          } catch {
            /* ignore */
          }
        }
      }
      setDataLoaded(true);
    }
    loadData();
  }, []);

  // Save pairs to both Supabase and localStorage
  useEffect(() => {
    if (!dataLoaded) return;
    if (pairs.length > 0) {
      localStorage.setItem("pickleball-pairs", JSON.stringify(pairs));
      savePairs(pairs);
    }
  }, [pairs, dataLoaded]);

  // Track local pair count to detect remote changes
  const localPairCountRef = useRef(0);
  useEffect(() => { localPairCountRef.current = pairs.length; }, [pairs]);

  // Realtime subscription — detect data changes from other devices
  const [hasRemoteUpdate, setHasRemoteUpdate] = useState(false);

  useEffect(() => {
    if (!dataLoaded) return;

    // Method 1: Supabase Realtime (requires Realtime replication enabled on table)
    const unsub = subscribeTournamentData((key, data) => {
      if (key === "pairs") {
        const remotePairs = (data as Pair[]) ?? [];
        const localCount = localPairCountRef.current;
        if (remotePairs.length !== localCount) {
          setHasRemoteUpdate(true);
        }
      }
    });

    // Method 2: Polling fallback (every 5s) — works even without Realtime enabled
    const pollInterval = setInterval(async () => {
      try {
        const remotePairs = await fetchPairs();
        const localCount = localPairCountRef.current;
        if (remotePairs.length !== localCount) {
          setHasRemoteUpdate(true);
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);

    return () => {
      unsub();
      clearInterval(pollInterval);
    };
  }, [dataLoaded]);

  const handleReloadData = useCallback(async () => {
    const dbPairs = await fetchPairs();
    setPairs(dbPairs);
    localStorage.setItem("pickleball-pairs", JSON.stringify(dbPairs));
    setHasRemoteUpdate(false);
    setShowResult(false);
    setSpinning(false);
  }, []);

  const pairedMaleIds = pairs.map((p) => p.male.id);
  const pairedFemaleIds = pairs.map((p) => p.female.id);
  const remainingMales = malePlayers.filter(
    (p) => !pairedMaleIds.includes(p.id),
  );
  const remainingFemales = femalePlayers.filter(
    (p) => !pairedFemaleIds.includes(p.id),
  );
  const isComplete = pairs.length >= totalPairs;
  const isLastPair =
    remainingMales.length === 1 && remainingFemales.length === 1;

  // Auto-pair the last remaining couple (no spin needed)
  useEffect(() => {
    if (!isLastPair || isComplete || spinning) return;
    const timeout = setTimeout(() => {
      const newPair: Pair = { male: remainingMales[0], female: remainingFemales[0] };
      setLastPair(newPair);
      setPairs((prev) => [...prev, newPair]);
      setShowResult(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#10b981", "#3b82f6", "#ec4899", "#f59e0b", "#8b5cf6"],
      });
    }, 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLastPair, isComplete, spinning]);
  // Fire confetti helper
  const fireConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#10b981", "#3b82f6", "#ec4899", "#f59e0b", "#8b5cf6"],
    });
  };

  // ---- Mode 1 (Dual): Both wheels spin ----
  const handleSpinDual = useCallback(() => {
    if (spinning || isComplete) return;

    if (isLastPair) {
      const lastMale = remainingMales[0];
      const lastFemale = remainingFemales[0];
      const newPair: Pair = { male: lastMale, female: lastFemale };
      setTimeout(() => {
        setLastPair(newPair);
        setPairs((prev) => [...prev, newPair]);
        setShowResult(true);
        fireConfetti();
      }, 400);
      return;
    }

    // Pick a random male, then find his predetermined female
    const randomMale =
      remainingMales[Math.floor(Math.random() * remainingMales.length)];
    const pairedFemaleId = PREDETERMINED_PAIRS[randomMale.id];
    // Check if that female is still available
    const femaleAvailable = remainingFemales.some(
      (f) => f.id === pairedFemaleId,
    );
    if (femaleAvailable) {
      setTargetMaleId(randomMale.id);
      setTargetFemaleId(pairedFemaleId);
    } else {
      // Fallback: pick any available pair
      for (const m of remainingMales) {
        const fId = PREDETERMINED_PAIRS[m.id];
        if (remainingFemales.some((f) => f.id === fId)) {
          setTargetMaleId(m.id);
          setTargetFemaleId(fId);
          break;
        }
      }
    }
    setSpinning(true);
    setPendingMale(null);
    setPendingFemale(null);
  }, [spinning, isComplete, isLastPair, remainingMales, remainingFemales]);

  // ---- Mode 2 (Pick): Only male wheel spins, female from dropdown ----
  const handleSpinPick = useCallback(() => {
    if (spinning || isComplete) return;
    if (!selectedFemale) return;

    if (remainingMales.length === 1) {
      const newPair: Pair = { male: remainingMales[0], female: selectedFemale };
      setTimeout(() => {
        setLastPair(newPair);
        setPairs((prev) => [...prev, newPair]);
        setShowResult(true);
        setSelectedFemale(null);
        fireConfetti();
      }, 400);
      return;
    }

    // Find the predetermined male for the selected female
    const pairedMaleId = FEMALE_TO_MALE[selectedFemale.id];
    if (pairedMaleId && remainingMales.some((m) => m.id === pairedMaleId)) {
      setTargetMaleId(pairedMaleId);
    } else {
      setTargetMaleId(undefined); // random fallback
    }
    setTargetFemaleId(undefined);
    setSpinning(true);
    setPendingMale(null);
    setPendingFemale(selectedFemale);
  }, [spinning, isComplete, selectedFemale, remainingMales]);

  const handleSpin = mode === "dual" ? handleSpinDual : handleSpinPick;

  const handleMaleSpinEnd = useCallback((player: Player) => {
    setPendingMale(player);
  }, []);

  const handleFemaleSpinEnd = useCallback((player: Player) => {
    setPendingFemale(player);
  }, []);

  // Check when both results are ready
  useEffect(() => {
    if (!pendingMale || !pendingFemale || !spinning) return;

    const newPair: Pair = { male: pendingMale, female: pendingFemale };
    setLastPair(newPair);
    setPairs((prev) => [...prev, newPair]);
    setShowResult(true);
    setSpinning(false);
    setSelectedFemale(null);
    fireConfetti();
  }, [pendingMale, pendingFemale, spinning]);

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const doReset = () => {
    setPairs([]);
    localStorage.removeItem("pickleball-pairs");
    localStorage.removeItem("pickleball-bracket");
    resetTournament(); // Clear Supabase
    setShowResult(false);
    setShowResetConfirm(false);
    setLastPair(null);
    setSelectedFemale(null);
  };

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleSpin();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSpin]);

  // Spin button disabled state
  const spinDisabled =
    spinning ||
    isComplete ||
    (mode === "pick" && !selectedFemale && !isLastPair);

  // Button label
  const getButtonLabel = () => {
    if (isLastPair) return "CẶP CUỐI";
    if (mode === "pick" && !selectedFemale) return "CHỌN NỮ TRƯỚC";
    return "QUAY SỐ";
  };

  return (
    <>
      <Navbar />
      <main className="pt-14 sm:pt-20 pb-8 sm:pb-16 min-h-screen">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center py-4 sm:py-8 px-4 sm:px-6"
        >
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight">
            <span className="text-shimmer">VÒNG QUAY BẮT CẶP</span>
          </h1>
          <p
            className="mt-1 sm:mt-2 text-xs sm:text-base"
            style={{ color: "var(--text-secondary)" }}
          >
            Mỗi lần quay chọn 1 nam + 1 nữ thành 1 đội mixed doubles
          </p>
        </motion.section>

        {/* Two-column layout: Wheels + Sidebar */}
        <div className="max-w-[1500px] mx-auto flex flex-col lg:flex-row gap-4 sm:gap-6 px-3 sm:px-4 lg:px-6">
          {/* ===== LEFT: Wheels & Controls ===== */}
          <div className="flex-1 min-w-0">
            {/* Mode toggle hidden — using pick mode only */}

            {/* Status */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center text-xs sm:text-sm pb-4 sm:pb-6"
              style={{ color: "var(--text-secondary)" }}
            >
              Đã bắt cặp:{" "}
              <span className="font-bold text-emerald-500">{pairs.length}</span>{" "}
              / {totalPairs} cặp &nbsp;•&nbsp; Còn lại:{" "}
              <span className="font-bold" style={{ color: "var(--male)" }}>
                {remainingMales.length}
              </span>{" "}
              nam,{" "}
              <span className="font-bold" style={{ color: "var(--female)" }}>
                {remainingFemales.length}
              </span>{" "}
              nữ
            </motion.div>

            {/* Wheels */}
            <AnimatePresence mode="wait">
              {mode === "dual" ? (
                <motion.section
                  key="dual"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center gap-6 sm:gap-10 sm:flex-row md:gap-14 pb-6 sm:pb-8"
                >
                  <div className="flex flex-col items-center gap-4">
                    <span
                      className="text-xs sm:text-sm font-extrabold tracking-[0.2em]"
                      style={{ color: "var(--male)" }}
                    >
                      ♂ NAM
                    </span>
                    <div className="relative">
                      <div
                        className={`rounded-full ${remainingMales.length > 0 ? "wheel-glow-male" : ""}`}
                      >
                        <SpinningWheel
                          players={remainingMales}
                          type="male"
                          size={wheelSize}
                          spinning={spinning}
                          onSpinEnd={handleMaleSpinEnd}
                          onSpin={handleSpin}
                          targetPlayerId={targetMaleId}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <span
                      className="text-xs sm:text-sm font-extrabold tracking-[0.2em]"
                      style={{ color: "var(--female)" }}
                    >
                      ♀ NỮ
                    </span>
                    <div className="relative">
                      <div
                        className={`rounded-full ${remainingFemales.length > 0 ? "wheel-glow-female" : ""}`}
                      >
                        <SpinningWheel
                          players={remainingFemales}
                          type="female"
                          size={wheelSize}
                          spinning={spinning}
                          onSpinEnd={handleFemaleSpinEnd}
                          onSpin={handleSpin}
                          targetPlayerId={targetFemaleId}
                        />
                      </div>
                    </div>
                  </div>
                </motion.section>
              ) : (
                <motion.section
                  key="pick"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center gap-6 sm:gap-10 sm:flex-row md:gap-14 pb-6 sm:pb-8"
                >
                  {/* Female Selector */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-4 min-w-[280px]"
                  >
                    <span
                      className="text-xs sm:text-sm font-extrabold tracking-[0.2em] uppercase"
                      style={{ color: "var(--female)" }}
                    >
                      ♀ Chọn Nữ
                    </span>
                    <AnimatePresence mode="wait">
                      {selectedFemale ? (
                        <motion.div
                          key={selectedFemale.id}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          className="flex flex-col items-center gap-3"
                        >
                          <div className="relative">
                            <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 opacity-30 blur-md animate-pulse" />
                            <div
                              className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden ring-4 ring-pink-400 ring-offset-4 shadow-xl"
                              style={
                                {
                                  ["--tw-ring-offset-color" as string]:
                                    "var(--bg-primary)",
                                } as React.CSSProperties
                              }
                            >
                              <Image
                                src={selectedFemale.image}
                                alt={selectedFemale.displayName}
                                fill
                                className="object-cover"
                              />
                            </div>
                          </div>
                          <span className="font-bold text-lg sm:text-xl bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
                            {selectedFemale.displayName}
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="placeholder"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="w-22 h-22 sm:w-26 sm:h-26 rounded-full border-2 border-dashed flex items-center justify-center"
                          style={{
                            background: "var(--bg-hover)",
                            borderColor: "var(--female)",
                            width: 96,
                            height: 96,
                          }}
                        >
                          <span className="text-3xl opacity-40">♀</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5 mt-1 w-full max-w-[340px]">
                      {remainingFemales.map((female) => (
                        <motion.button
                          key={female.id}
                          whileHover={{ scale: 1.06, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedFemale(female)}
                          className={`flex flex-col items-center gap-1.5 p-2 sm:p-2.5 rounded-2xl transition-all duration-200 ${selectedFemale?.id === female.id ? "ring-2 ring-pink-400 shadow-lg shadow-pink-500/20" : "hover:shadow-md"}`}
                          style={
                            selectedFemale?.id === female.id
                              ? {
                                  background:
                                    "color-mix(in srgb, var(--female) 12%, transparent)",
                                }
                              : {
                                  background: "var(--bg-hover)",
                                  border: "1px solid var(--border-subtle)",
                                }
                          }
                        >
                          <div
                            className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden transition-all ${selectedFemale?.id === female.id ? "ring-2 ring-pink-300 ring-offset-1" : ""}`}
                          >
                            <Image
                              src={female.image}
                              alt={female.displayName}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <span
                            className="text-[9px] sm:text-[10px] font-semibold truncate max-w-[60px] sm:max-w-[68px]"
                            style={{
                              color:
                                selectedFemale?.id === female.id
                                  ? "var(--female)"
                                  : "var(--text-secondary)",
                            }}
                          >
                            {female.displayName}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                  {/* Male Wheel */}
                  <div className="flex flex-col items-center gap-4">
                    <span
                      className="text-xs sm:text-sm font-extrabold tracking-[0.2em]"
                      style={{ color: "var(--male)" }}
                    >
                      ♂ QUAY NAM
                    </span>
                    <div className="relative">
                      <div
                        className={`rounded-full ${remainingMales.length > 0 ? "wheel-glow-male" : ""}`}
                      >
                        <SpinningWheel
                          players={remainingMales}
                          type="male"
                          size={wheelSize}
                          spinning={spinning}
                          onSpinEnd={handleMaleSpinEnd}
                          onSpin={handleSpin}
                          targetPlayerId={targetMaleId}
                        />
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Done Message */}
            {isComplete && (
              <section className="text-center py-3 sm:py-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="text-lg sm:text-2xl font-black text-shimmer">
                    🏅 ĐÃ BẮT CẶP XONG {totalPairs} ĐỘI! 🏅
                  </div>
                  <Link href="/bracket">
                    <motion.span
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="inline-flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-bold tracking-wider shadow-lg text-sm sm:text-base"
                      style={{
                        background:
                          "linear-gradient(to right, var(--gold), var(--gold-dark))",
                        color: "var(--bg-primary)",
                      }}
                    >
                      🏆 XEM NHÁNH ĐẤU
                    </motion.span>
                  </Link>
                </motion.div>
              </section>
            )}
          </div>

          {/* ===== RIGHT: Pairs Sidebar ===== */}
          <motion.aside
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full lg:w-[300px] shrink-0 lg:sticky lg:top-24 lg:self-start"
          >
            <div className="glass-card rounded-2xl p-3.5 sm:p-5 shadow-lg">
              <h2
                className="text-[10px] sm:text-xs font-bold tracking-[0.15em] sm:tracking-[0.2em] text-center mb-3 sm:mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                🏸 CÁC CẶP ĐÃ BẮT ({pairs.length}/{totalPairs})
              </h2>

              {pairs.length === 0 ? (
                <div className="text-center py-4 sm:py-8 opacity-40">
                  <div className="text-2xl sm:text-3xl mb-2">🏓</div>
                  <p className="text-xs text-slate-400">Chưa có cặp nào</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {pairs.map((pair, i) => (
                      <motion.div
                        key={`${pair.male.id}-${pair.female.id}`}
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-2.5 rounded-xl transition-all"
                        style={{
                          background: "var(--sidebar-item-bg)",
                          border: "1px solid var(--sidebar-item-border)",
                        }}
                      >
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                          <span className="text-white text-[10px] sm:text-xs font-black">
                            {i + 1}
                          </span>
                        </div>
                        <div className="flex -space-x-2">
                          <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden ring-2 ring-blue-300 ring-offset-1">
                            <Image
                              src={pair.male.image}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden ring-2 ring-pink-300 ring-offset-1">
                            <Image
                              src={pair.female.image}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-xs font-bold truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {pair.male.displayName}
                          </div>
                          <div
                            className="text-xs truncate"
                            style={{ color: "var(--female)" }}
                          >
                            {pair.female.displayName}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Reset button hidden */}
            </div>
          </motion.aside>
        </div>
      </main>

      {/* Result Modal */}
      <PairResultModal
        male={lastPair?.male ?? null}
        female={lastPair?.female ?? null}
        visible={showResult}
        pairNumber={pairs.length}
        onClose={() => setShowResult(false)}
      />

      {/* Reset Confirm Modal */}
      <ConfirmModal
        visible={showResetConfirm}
        title="⚠️ Xóa tất cả?"
        message="Bạn có chắc muốn xóa tất cả các cặp đã bắt và kết quả nhánh đấu? Hành động này không thể hoàn tác."
        confirmText="Xóa hết"
        cancelText="Giữ lại"
        variant="danger"
        onConfirm={doReset}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Countdown lock overlay — blocks until 18:00 */}
      <AnimatePresence>
        {isLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
            }}
          >
            <div className="text-center px-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, delay: 0.2 }}
                className="text-7xl sm:text-8xl mb-6"
              >
                🏓
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-2xl sm:text-4xl font-black text-white mb-2 tracking-tight"
              >
                PICKLEBALL OPEN
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-blue-300 text-sm sm:text-base mb-10 font-medium"
              >
                Vòng quay bắt cặp sẽ mở lúc 18:00
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 }}
                className="inline-flex items-center gap-1 sm:gap-2 px-6 sm:px-10 py-4 sm:py-6 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  backdropFilter: "blur(10px)",
                }}
              >
                {countdown.split("").map((char, i) => (
                  <span
                    key={i}
                    className={`font-mono font-black ${
                      char === ":"
                        ? "text-2xl sm:text-4xl text-blue-400 animate-pulse mx-0.5"
                        : "text-4xl sm:text-6xl text-white"
                    }`}
                    style={
                      char !== ":"
                        ? {
                            background: "rgba(59,130,246,0.15)",
                            borderRadius: "8px",
                            padding: "4px 8px",
                            minWidth: "2.5rem",
                            display: "inline-block",
                            textAlign: "center",
                          }
                        : {}
                    }
                  >
                    {char}
                  </span>
                ))}
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-white/40 text-xs mt-8"
              >
                Hãy chuẩn bị sẵn sàng! ⏳
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remote data change overlay */}
      <AnimatePresence>
        {hasRemoteUpdate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center p-8 rounded-2xl shadow-2xl max-w-sm mx-4"
              style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
            >
              <div className="text-5xl mb-4">🔄</div>
              <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                Dữ liệu đã thay đổi!
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                Có người đã quay trên thiết bị khác. Nhấn nút bên dưới để cập nhật dữ liệu mới nhất.
              </p>
              <button
                onClick={handleReloadData}
                className="px-8 py-3 rounded-full font-bold text-white bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 shadow-lg transition-all active:scale-95"
              >
                🔄 Tải lại dữ liệu
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
