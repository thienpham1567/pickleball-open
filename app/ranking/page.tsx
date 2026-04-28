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
}

const players: Player[] = [
  {
    rank: 1,
    name: "Anh Dũng",
    image: "/hinhmn/a-dung.png",
    gender: "male",
    quote: "Ông hoàng sân BKF 👑",
  },
  {
    rank: 1,
    name: "Anh Thìn",
    image: "/hinhmn/a-thin.jpg",
    gender: "male",
    quote: "Đối thủ xứng tầm 🔥",
  },
  {
    rank: 2,
    name: "Chị Thu Julie",
    image: "/hinhmn/c-thu.jpg",
    gender: "female",
    quote: "Nữ hoàng sexy 💫",
  },
  {
    rank: 2,
    name: "Chị Quỳnh",
    image: "/hinhmn/c-quynh.jpeg",
    gender: "female",
    quote: "Nữ hoàng hồi teen",
  },
  {
    rank: 3,
    name: "Chị Trúc",
    image: "/hinhmn/c-truc.jpeg",
    gender: "female",
    quote: "Cô giáo",
  },
  {
    rank: 4,
    name: "Anh Pháp",
    image: "/hinhmn/a-phap.jpg",
    gender: "male",
    quote: "Cọc nhất nhóm",
  },
  {
    rank: 5,
    name: "Thiên",
    image: "/hinhmn/c-me.jpg",
    gender: "female",
    quote: "Lữ yếu",
  },
];

/* ──────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────── */
const rankEmoji = (rank: number) => {
  switch (rank) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return `#${rank}`;
  }
};

const rankGradient = (rank: number) => {
  switch (rank) {
    case 1:
      return "linear-gradient(135deg, #FFD700, #FFA000, #FFD700)";
    case 2:
      return "linear-gradient(135deg, #C0C0C0, #E8E8E8, #C0C0C0)";
    case 3:
      return "linear-gradient(135deg, #CD7F32, #E8A862, #CD7F32)";
    default:
      return "linear-gradient(135deg, var(--bg-card), var(--bg-secondary))";
  }
};

const rankGlow = (rank: number) => {
  switch (rank) {
    case 1:
      return "0 0 30px rgba(255, 215, 0, 0.4), 0 0 60px rgba(255, 160, 0, 0.2)";
    case 2:
      return "0 0 25px rgba(192, 192, 192, 0.35), 0 0 50px rgba(192, 192, 192, 0.15)";
    case 3:
      return "0 0 20px rgba(205, 127, 50, 0.3), 0 0 40px rgba(205, 127, 50, 0.12)";
    default:
      return "var(--shadow-card)";
  }
};

const ringColor = (rank: number, gender: "male" | "female") => {
  if (rank === 1) return "rgba(255, 215, 0, 0.7)";
  if (rank === 2) return "rgba(192, 192, 192, 0.6)";
  if (rank === 3) return "rgba(205, 127, 50, 0.6)";
  return gender === "male" ? "var(--male)" : "var(--female)";
};

const rankBorderGradient = (rank: number, gender: "male" | "female") => {
  if (rank === 1)
    return "linear-gradient(135deg, #FFD700, #FFA000, #FFD700, #FFA000)";
  if (rank === 2)
    return "linear-gradient(135deg, #C0C0C0, #E8E8E8, #C0C0C0, #E8E8E8)";
  if (rank === 3)
    return "linear-gradient(135deg, #CD7F32, #E8A862, #CD7F32, #E8A862)";
  return gender === "male"
    ? "linear-gradient(135deg, #60a5fa, #3b82f6, #60a5fa)"
    : "linear-gradient(135deg, #f472b6, #ec4899, #f472b6)";
};

/* ──────────────────────────────────────────────
   COMPONENTS
   ────────────────────────────────────────────── */

function FloatingParticles() {
  const [particles, setParticles] = useState<
    {
      id: number;
      x: number;
      y: number;
      size: number;
      delay: number;
      duration: number;
    }[]
  >([]);

  useEffect(() => {
    const p = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 5,
      duration: Math.random() * 10 + 10,
    }));
    setParticles(p);
  }, []);

  return (
    <div className="particles-container" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Lightbox Modal ── */
function Lightbox({
  player,
  onClose,
}: {
  player: Player | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {player && (
        <motion.div
          className="lightbox-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
        >
          <motion.div
            className="lightbox-content"
            initial={{ scale: 0.7, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button className="lightbox-close" onClick={onClose}>
              ✕
            </button>

            {/* Image */}
            <div className="lightbox-image-wrapper">
              <Image
                src={player.image}
                alt={player.name}
                width={600}
                height={700}
                className="lightbox-image"
                style={{ objectFit: "contain" }}
                priority
              />
            </div>

            {/* Info bar */}
            <div className="lightbox-info">
              <div className="lightbox-rank-badge">
                {rankEmoji(player.rank)}
              </div>
              <div>
                <h3 className="lightbox-name">{player.name}</h3>
                <p className="lightbox-quote">{player.quote}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Champion Portrait Card (Top players) ── */
function ChampionCard({
  player,
  index,
  onViewImage,
}: {
  player: Player;
  index: number;
  onViewImage: (p: Player) => void;
}) {
  return (
    <motion.div
      className="champion-card"
      initial={{ opacity: 0, y: 60, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.8,
        delay: index * 0.15,
        type: "spring",
        stiffness: 80,
      }}
      whileHover={{ y: -8, scale: 1.02 }}
      style={{
        boxShadow: rankGlow(player.rank),
      }}
    >
      {/* Crown for #1 */}
      {player.rank === 1 && (
        <motion.div
          className="crown-icon"
          animate={{ y: [0, -6, 0], rotate: [-5, 5, -5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          👑
        </motion.div>
      )}

      {/* Portrait image — tall card with full view */}
      <div
        className="champion-portrait"
        onClick={() => onViewImage(player)}
        style={{
          borderColor: ringColor(player.rank, player.gender),
        }}
      >
        <div className="champion-portrait-inner">
          <Image
            src={player.image}
            alt={player.name}
            fill
            sizes="(max-width: 640px) 85vw, 340px"
            className="champion-portrait-img"
            style={{ objectFit: "cover", objectPosition: "center 20%" }}
            priority
          />
        </div>

        {/* Gradient overlay at bottom */}
        <div className="champion-portrait-overlay" />

        {/* Rank badge on image */}
        <div
          className="champion-rank-badge"
          style={{ background: rankGradient(player.rank) }}
        >
          <span className="champion-rank-emoji">
            {rankEmoji(player.rank)}
          </span>
        </div>

        {/* Tap to view hint */}
        <div className="champion-tap-hint">
          <span>👆 Xem ảnh đầy đủ</span>
        </div>
      </div>

      {/* Info below image */}
      <div className="champion-info">
        <h3
          className="champion-name"
          style={{
            background: rankGradient(player.rank),
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {player.name}
        </h3>
        <p className="champion-quote">{player.quote}</p>
      </div>

      {/* Shimmer line */}
      <div className="champion-shimmer" />
    </motion.div>
  );
}

/* ── Ranking Card (for #2 and below) ── */
function RankingCard({
  player,
  index,
  onViewImage,
}: {
  player: Player;
  index: number;
  onViewImage: (p: Player) => void;
}) {
  const isTopThree = player.rank <= 3;

  return (
    <motion.div
      className={`rank-card ${isTopThree ? "rank-card--medal" : ""}`}
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        delay: 0.3 + index * 0.1,
        type: "spring",
        stiffness: 100,
      }}
      whileHover={{ y: -6, scale: 1.03 }}
      style={{
        boxShadow: isTopThree ? rankGlow(player.rank) : "var(--shadow-card)",
      }}
    >
      {/* Portrait image */}
      <div
        className="rank-card-image"
        onClick={() => onViewImage(player)}
      >
        <Image
          src={player.image}
          alt={player.name}
          fill
          sizes="(max-width: 640px) 45vw, 200px"
          className="rank-card-img"
          style={{ objectFit: "cover", objectPosition: "center 20%" }}
        />
        <div className="rank-card-image-overlay" />

        {/* Rank badge */}
        <div
          className="rank-card-rank"
          style={{
            background: isTopThree
              ? rankGradient(player.rank)
              : "var(--bg-glass)",
          }}
        >
          {isTopThree ? (
            <span style={{ fontSize: "1.2rem" }}>{rankEmoji(player.rank)}</span>
          ) : (
            <span
              style={{
                color: "var(--text-muted)",
                fontWeight: 800,
                fontFamily: "var(--font-display)",
              }}
            >
              {player.rank}
            </span>
          )}
        </div>

        {/* Tap hint */}
        <div className="rank-card-tap">👆</div>
      </div>

      {/* Info */}
      <div className="rank-card-info">
        <span
          className="rank-card-name"
          style={
            isTopThree
              ? {
                  background: rankGradient(player.rank),
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }
              : { color: "var(--text-primary)" }
          }
        >
          {player.name}
        </span>
        <span className="rank-card-quote">{player.quote}</span>

        {/* Gender indicator */}
        <div
          className="rank-card-gender"
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
      </div>

      {/* Border glow */}
      {isTopThree && (
        <div
          className="rank-card-border-glow"
          style={{
            background: rankBorderGradient(player.rank, player.gender),
          }}
        />
      )}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   PAGE
   ────────────────────────────────────────────── */
export default function RankingPage() {
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);

  const champions = players.filter((p) => p.rank === 1);
  const others = players.filter((p) => p.rank > 1);

  const handleViewImage = useCallback((p: Player) => {
    setViewingPlayer(p);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setViewingPlayer(null);
  }, []);

  return (
    <main className="ranking-page">
      <FloatingParticles />

      {/* ── Lightbox ── */}
      <Lightbox player={viewingPlayer} onClose={handleCloseLightbox} />

      {/* ── Header ── */}
      <motion.header
        className="ranking-header"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="ranking-icon"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          🏓
        </motion.div>

        <h1 className="ranking-title text-shimmer">
          Bảng xếp hạng đánh hay sân BKF
        </h1>
        <p className="ranking-subtitle">
          Top người chơi xuất sắc nhất • Mùa giải 2025
        </p>

        <div className="ranking-divider">
          <span className="divider-star">⭐</span>
        </div>
      </motion.header>

      {/* ── Champions Spotlight (Rank #1) ── */}
      <section className="champions-section">
        <motion.h2
          className="section-label"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          🏆 Vô địch đồng hạng
        </motion.h2>
        <div className="champions-grid">
          {champions.map((p, i) => (
            <ChampionCard
              key={p.name}
              player={p}
              index={i}
              onViewImage={handleViewImage}
            />
          ))}
        </div>
      </section>

      {/* ── Others Grid (#2 and below) ── */}
      <section className="others-section">
        <motion.h2
          className="section-label"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          📊 Bảng xếp hạng
        </motion.h2>
        <div className="others-grid">
          {others.map((p, i) => (
            <RankingCard
              key={p.name}
              player={p}
              index={i}
              onViewImage={handleViewImage}
            />
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <motion.footer
        className="ranking-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <p>Sân Pickleball BKF • Cập nhật: Tháng 4/2025</p>
      </motion.footer>
    </main>
  );
}
