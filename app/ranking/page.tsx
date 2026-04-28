"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import "./ranking.css";

/* ──────────────────────────────────────────────
   DATA
   ────────────────────────────────────────────── */
interface Player {
  rank: number;
  name: string;
  image: string;
  gender: "male" | "female";
  quote: string;
  /** Custom object-position for avatar crop */
  imagePos?: string;
}

const players: Player[] = [
  {
    rank: 1,
    name: "Anh Dũng",
    image: "/hinhmn/a-dung.png",
    gender: "male",
    quote: "Ông hoàng sân BKF 👑",
    imagePos: "center top",
  },
  {
    rank: 1,
    name: "Anh Thìn",
    image: "/hinhmn/a-thin.jpg",
    gender: "male",
    quote: "Troai tân",
    imagePos: "55% 30%",
  },
  {
    rank: 2,
    name: "Chị Thu Julie",
    image: "/hinhmn/c-thu.jpg",
    gender: "female",
    quote: "Nữ hoàng sexy",
    imagePos: "center 15%",
  },
  {
    rank: 2,
    name: "Chị Quỳnh",
    image: "/hinhmn/c-quynh.jpeg",
    gender: "female",
    quote: "Nữ hoàng hồi teen",
    imagePos: "center 25%",
  },
  {
    rank: 3,
    name: "Chị Trúc",
    image: "/hinhmn/c-truc.jpeg",
    gender: "female",
    quote: "Cô giáo",
    imagePos: "center 20%",
  },
  {
    rank: 4,
    name: "Anh Pháp",
    image: "/hinhmn/a-phap.jpg",
    gender: "male",
    quote: "Cọc nhất nhóm",
    imagePos: "center 25%",
  },
  {
    rank: 5,
    name: "Thiên",
    image: "/hinhmn/c-me.jpg",
    gender: "male",
    quote: "Đẹp trai cao to",
    imagePos: "center 10%",
  },
];

/* ──────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────── */
const MEDAL_CONFIG: Record<
  number,
  { emoji: string; color: string; glow: string; bg: string; label: string }
> = {
  1: {
    emoji: "🥇",
    color: "#FFD700",
    glow: "0 0 20px rgba(255,215,0,0.5)",
    bg: "linear-gradient(135deg, #FFD700, #FFA000)",
    label: "HẠNG NHẤT",
  },
  2: {
    emoji: "🥈",
    color: "#B8C4D0",
    glow: "0 0 20px rgba(184,196,208,0.4)",
    bg: "linear-gradient(135deg, #C0C0C0, #E0E0E0)",
    label: "HẠNG NHÌ",
  },
  3: {
    emoji: "🥉",
    color: "#CD7F32",
    glow: "0 0 20px rgba(205,127,50,0.4)",
    bg: "linear-gradient(135deg, #CD7F32, #E8A862)",
    label: "HẠNG BA",
  },
};

const getRankStyle = (rank: number) =>
  MEDAL_CONFIG[rank] || {
    emoji: "",
    color: "var(--text-muted)",
    glow: "none",
    bg: "var(--bg-card)",
    label: `HẠNG ${rank}`,
  };

/* ──────────────────────────────────────────────
   FLOATING PARTICLES
   ────────────────────────────────────────────── */
function FloatingParticles() {
  const [particles, setParticles] = useState<
    {
      id: number;
      x: number;
      y: number;
      size: number;
      delay: number;
      dur: number;
    }[]
  >([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1.5,
        delay: Math.random() * 6,
        dur: Math.random() * 12 + 10,
      })),
    );
  }, []);

  return (
    <div className="rk-particles" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="rk-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────
   LIGHTBOX
   ────────────────────────────────────────────── */
function Lightbox({
  player,
  onClose,
}: {
  player: Player | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!player) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [player, onClose]);

  return (
    <AnimatePresence>
      {player && (
        <motion.div
          className="rk-lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="rk-lightbox-card"
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="rk-lightbox-close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
            <div className="rk-lightbox-img-wrap">
              <Image
                src={player.image}
                alt={player.name}
                fill
                sizes="(max-width:600px) 92vw, 480px"
                className="rk-lightbox-img"
                priority
              />
            </div>
            <div className="rk-lightbox-footer">
              <span className="rk-lightbox-medal">
                {getRankStyle(player.rank).emoji || `#${player.rank}`}
              </span>
              <div>
                <h3 className="rk-lightbox-name">{player.name}</h3>
                <p className="rk-lightbox-quote">{player.quote}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ──────────────────────────────────────────────
   LEADERBOARD ROW
   ────────────────────────────────────────────── */
function LeaderboardRow({
  player,
  index,
  onView,
}: {
  player: Player;
  index: number;
  onView: (p: Player) => void;
}) {
  const style = getRankStyle(player.rank);
  const isMedal = player.rank <= 3;

  return (
    <motion.div
      className={`rk-row ${isMedal ? "rk-row--medal" : ""}`}
      data-rank={player.rank}
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.5,
        delay: 0.15 + index * 0.08,
        type: "spring",
        stiffness: 120,
      }}
      whileHover={{ x: 6 }}
    >
      {/* Rank indicator */}
      <div
        className="rk-row-rank"
        style={isMedal ? { background: style.bg } : undefined}
      >
        {isMedal ? (
          <span className="rk-row-rank-emoji">{style.emoji}</span>
        ) : (
          <span className="rk-row-rank-num">{player.rank}</span>
        )}
      </div>

      {/* Avatar */}
      <button
        className="rk-row-avatar-btn"
        onClick={() => onView(player)}
        aria-label={`Xem ảnh ${player.name}`}
      >
        <div
          className="rk-row-avatar"
          style={
            isMedal
              ? { boxShadow: `0 0 0 3px ${style.color}, ${style.glow}` }
              : undefined
          }
        >
          <Image
            src={player.image}
            alt={player.name}
            width={72}
            height={72}
            className="rk-row-avatar-img"
            style={{ objectPosition: player.imagePos }}
          />
        </div>
        <span className="rk-row-avatar-zoom">🔍</span>
      </button>

      {/* Info */}
      <div className="rk-row-info">
        <div className="rk-row-name-line">
          <span
            className="rk-row-name"
            style={
              isMedal
                ? {
                    background: style.bg,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }
                : undefined
            }
          >
            {player.name}
          </span>
          {isMedal && (
            <span className="rk-row-label" style={{ color: style.color }}>
              {style.label}
            </span>
          )}
        </div>
        <span className="rk-row-quote">{player.quote}</span>
      </div>

      {/* Gender */}
      <div
        className="rk-row-gender"
        style={{
          background:
            player.gender === "male"
              ? "var(--male-ring)"
              : "var(--female-ring)",
          color: player.gender === "male" ? "var(--male)" : "var(--female)",
        }}
      >
        {player.gender === "male" ? "♂" : "♀"}
      </div>

      {/* Medal accent line */}
      {isMedal && (
        <div className="rk-row-accent" style={{ background: style.color }} />
      )}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   PAGE
   ────────────────────────────────────────────── */
export default function RankingPage() {
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);

  const sorted = [...players].sort((a, b) => a.rank - b.rank);
  const top3 = sorted.filter((p) => p.rank <= 3);
  const podiumOrder = (() => {
    // Podium: center = rank1, sides = rank2/3 — but handle ties
    const r1 = sorted.filter((p) => p.rank === 1);
    const r2 = sorted.filter((p) => p.rank === 2);
    const r3 = sorted.filter((p) => p.rank === 3);
    return { r1, r2, r3 };
  })();

  const handleView = useCallback((p: Player) => setViewingPlayer(p), []);
  const handleClose = useCallback(() => setViewingPlayer(null), []);

  return (
    <main className="rk-page">
      <FloatingParticles />
      <Lightbox player={viewingPlayer} onClose={handleClose} />

      {/* ── HEADER ── */}
      <motion.header
        className="rk-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="rk-header-badge">
          <motion.span
            animate={{ rotate: [0, -8, 8, -8, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ display: "inline-block", fontSize: "2.5rem" }}
          >
            🏓
          </motion.span>
        </div>
        <h1 className="rk-title text-shimmer">Bảng xếp hạng đánh hay</h1>
        <p className="rk-venue">SÂN PICKLEBALL BKF</p>
        <p className="rk-season">
          Mùa giải 2025 • Top {players.length} người chơi
        </p>
      </motion.header>

      {/* ── PODIUM ── */}
      <section className="rk-podium">
        {/* Rank 2 — left */}
        <div className="rk-podium-side rk-podium-left">
          {podiumOrder.r2.map((p, i) => (
            <PodiumAvatar
              key={p.name}
              player={p}
              delay={0.3 + i * 0.1}
              onView={handleView}
            />
          ))}
          <div className="rk-podium-bar rk-podium-bar--2">
            <span>2</span>
          </div>
        </div>

        {/* Rank 1 — center (elevated) */}
        <div className="rk-podium-center">
          {podiumOrder.r1.map((p, i) => (
            <PodiumAvatar
              key={p.name}
              player={p}
              delay={0.1 + i * 0.1}
              onView={handleView}
              isChamp
            />
          ))}
          <div className="rk-podium-bar rk-podium-bar--1">
            <span>1</span>
          </div>
        </div>

        {/* Rank 3 — right */}
        <div className="rk-podium-side rk-podium-right">
          {podiumOrder.r3.map((p, i) => (
            <PodiumAvatar
              key={p.name}
              player={p}
              delay={0.5 + i * 0.1}
              onView={handleView}
            />
          ))}
          <div className="rk-podium-bar rk-podium-bar--3">
            <span>3</span>
          </div>
        </div>
      </section>

      {/* ── FULL LEADERBOARD ── */}
      <section className="rk-board">
        <div className="rk-board-header">
          <span className="rk-board-title">Bảng xếp hạng đầy đủ</span>
          <span className="rk-board-count">{sorted.length} người chơi</span>
        </div>
        <div className="rk-board-list">
          {sorted.map((p, i) => (
            <LeaderboardRow
              key={p.name}
              player={p}
              index={i}
              onView={handleView}
            />
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <motion.footer
        className="rk-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <p>Sân Pickleball BKF • Cập nhật: Tháng 4/2025</p>
      </motion.footer>
    </main>
  );
}

/* ──────────────────────────────────────────────
   PODIUM AVATAR
   ────────────────────────────────────────────── */
function PodiumAvatar({
  player,
  delay,
  onView,
  isChamp = false,
}: {
  player: Player;
  delay: number;
  onView: (p: Player) => void;
  isChamp?: boolean;
}) {
  const style = getRankStyle(player.rank);

  return (
    <motion.div
      className={`rk-pod-player ${isChamp ? "rk-pod-player--champ" : ""}`}
      initial={{ opacity: 0, y: 30, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay, type: "spring", stiffness: 100 }}
    >
      {isChamp && (
        <motion.div
          className="rk-pod-crown"
          animate={{ y: [0, -4, 0], rotate: [-3, 3, -3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          👑
        </motion.div>
      )}

      <button
        className="rk-pod-avatar-btn"
        onClick={() => onView(player)}
        aria-label={`Xem ảnh ${player.name}`}
      >
        <div
          className="rk-pod-avatar"
          style={{ boxShadow: `0 0 0 3px ${style.color}, ${style.glow}` }}
        >
          <Image
            src={player.image}
            alt={player.name}
            width={isChamp ? 120 : 96}
            height={isChamp ? 120 : 96}
            className="rk-pod-avatar-img"
            style={{ objectPosition: player.imagePos }}
          />
        </div>
      </button>

      <span
        className="rk-pod-name"
        style={{
          background: style.bg,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {player.name}
      </span>
      <span className="rk-pod-quote">{player.quote}</span>
    </motion.div>
  );
}
