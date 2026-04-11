"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Player } from "@/lib/players";

interface SpinningWheelProps {
  players: Player[];
  type: "male" | "female";
  size?: number;
  spinning: boolean;
  onSpinEnd?: (player: Player) => void;
  onSpin?: () => void;
}

// Read wheel colors from CSS custom properties for theme support
function getWheelColors(type: "male" | "female"): string[] {
  const root = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const prefix = type === "male" ? "--wheel-male-" : "--wheel-female-";
  return [1, 2, 3, 4, 5, 6, 7].map((i) =>
    root?.getPropertyValue(`${prefix}${i}`).trim() || (type === "male" ? "#1e3a5f" : "#5b1a4a")
  );
}

function getTextColor(type: "male" | "female"): string {
  const root = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
  return root?.getPropertyValue(type === "male" ? "--text-male" : "--text-female").trim() || "#fff";
}

export default function SpinningWheel({
  players,
  type,
  size = 340,
  spinning,
  onSpinEnd,
  onSpin,
}: SpinningWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const hasSpun = useRef(false);

  // Offscreen canvas for caching the wheel (drawn once, rotated during animation)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const wheelDirty = useRef(true);

  const [themeKey, setThemeKey] = useState(0);

  // Watch for theme changes to re-read CSS variables
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeKey((k) => k + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const colors = getWheelColors(type);
  const textColor = getTextColor(type);

  // Mark wheel as dirty when players/theme/images change
  useEffect(() => { wheelDirty.current = true; }, [players, type, colors, textColor, themeKey]);

  // Build the offscreen wheel cache (expensive, done once)
  const buildWheelCache = useCallback(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for mobile perf
    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement("canvas");
    }
    const off = offscreenRef.current;
    off.width = size * dpr;
    off.height = size * dpr;
    const ctx = off.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, off.width, off.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const center = size / 2;
    const radius = size / 2 - 14;

    if (players.length === 0) {
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#f1f5f9";
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 44px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✓", center, center - 10);
      ctx.fillStyle = "#64748b";
      ctx.font = "600 14px system-ui";
      ctx.fillText("Hoàn tất", center, center + 25);
      ctx.restore();
      wheelDirty.current = false;
      return;
    }

    const segmentAngle = (2 * Math.PI) / players.length;

    // Outer glow ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 6, 0, 2 * Math.PI);
    ctx.strokeStyle = type === "male" ? "rgba(59, 130, 246, 0.12)" : "rgba(236, 72, 153, 0.12)";
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    // Draw segments (NO rotation — rotation applied when compositing)
    players.forEach((player, i) => {
      const startAngle = i * segmentAngle - Math.PI / 2;
      const endAngle = startAngle + segmentAngle;
      const midAngle = startAngle + segmentAngle / 2;
      const color = colors[i % colors.length];

      // Segment fill with gradient
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();

      const grad = ctx.createRadialGradient(center, center, radius * 0.2, center, center, radius);
      grad.addColorStop(0, color + "55");
      grad.addColorStop(0.6, color + "99");
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.fill();

      // Segment border
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Player photo — larger, centered in segment
      const img = imageCache.current.get(player.id);
      if (img) {
        const photoRadius = Math.min(radius * 0.22, 40);
        const photoDist = radius * 0.52;
        const px = Math.cos(midAngle) * photoDist;
        const py = Math.sin(midAngle) * photoDist;

        // Photo shadow
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(center + px, center + py, photoRadius, 0, 2 * Math.PI);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.restore();

        // Clip and draw photo
        ctx.save();
        ctx.beginPath();
        ctx.arc(center + px, center + py, photoRadius - 2, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.clip();

        const imgAspect = img.naturalWidth / img.naturalHeight;
        let sw = photoRadius * 2, sh = photoRadius * 2;
        if (imgAspect > 1) sw = sh * imgAspect;
        else sh = sw / imgAspect;

        ctx.drawImage(img, center + px - sw / 2, center + py - sh / 2, sw, sh);
        ctx.restore();

        // Photo white ring border
        ctx.beginPath();
        ctx.arc(center + px, center + py, photoRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Player name — curved along outer edge with dark backdrop
      const nameRadius = radius * 0.86;
      const nameAngle = midAngle;
      
      // Dark backdrop arc behind text
      const textArcSpan = segmentAngle * 0.7;
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, nameRadius + 7, nameAngle - textArcSpan / 2, nameAngle + textArcSpan / 2);
      ctx.arc(center, center, nameRadius - 7, nameAngle + textArcSpan / 2, nameAngle - textArcSpan / 2, true);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fill();
      ctx.restore();

      // Draw name text
      const tx = Math.cos(nameAngle) * nameRadius;
      const ty = Math.sin(nameAngle) * nameRadius;

      ctx.save();
      ctx.translate(center + tx, center + ty);
      let textAngle = nameAngle;
      if (textAngle > Math.PI / 2 && textAngle < (3 * Math.PI) / 2) textAngle += Math.PI;
      if (textAngle < -Math.PI / 2 && textAngle > (-3 * Math.PI) / 2) textAngle += Math.PI;
      ctx.rotate(textAngle);
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Strong outline for readability
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeText(player.displayName, 0, 0);

      // White fill
      ctx.fillStyle = "#ffffff";
      ctx.fillText(player.displayName, 0, 0);
      ctx.restore();
    });

    // Premium outer ring
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, 2 * Math.PI);
    const ringGrad = ctx.createLinearGradient(0, 0, size, size);
    if (type === "male") {
      ringGrad.addColorStop(0, "rgba(59, 130, 246, 0.4)");
      ringGrad.addColorStop(0.5, "rgba(99, 160, 255, 0.5)");
      ringGrad.addColorStop(1, "rgba(59, 130, 246, 0.4)");
    } else {
      ringGrad.addColorStop(0, "rgba(236, 72, 153, 0.4)");
      ringGrad.addColorStop(0.5, "rgba(255, 120, 180, 0.5)");
      ringGrad.addColorStop(1, "rgba(236, 72, 153, 0.4)");
    }
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Inner highlight ring
    ctx.beginPath();
    ctx.arc(center, center, radius - 3, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
    wheelDirty.current = false;
  }, [players, type, size, colors, textColor, themeKey]);

  // Fast render: rotate cached wheel + draw static center hub
  const render = useCallback(
    (rotation: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (wheelDirty.current || !offscreenRef.current) {
        buildWheelCache();
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const center = size / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      if (players.length === 0) {
        if (offscreenRef.current) {
          ctx.drawImage(offscreenRef.current, 0, 0, size, size);
        }
        ctx.restore();
        return;
      }

      // Draw rotated cached wheel (single drawImage — very fast!)
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(rotation);
      ctx.translate(-center, -center);
      if (offscreenRef.current) {
        ctx.drawImage(offscreenRef.current, 0, 0, size, size);
      }
      ctx.restore();

      // Center hub (not rotated, drawn on top)
      const hubRadius = 32;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3;

      ctx.beginPath();
      ctx.arc(center, center, hubRadius, 0, 2 * Math.PI);
      const hubGrad = ctx.createRadialGradient(center - 6, center - 6, 0, center, center, hubRadius);
      if (type === "male") {
        hubGrad.addColorStop(0, "#60a5fa");
        hubGrad.addColorStop(0.7, "#3b82f6");
        hubGrad.addColorStop(1, "#2563eb");
      } else {
        hubGrad.addColorStop(0, "#f472b6");
        hubGrad.addColorStop(0.7, "#ec4899");
        hubGrad.addColorStop(1, "#db2777");
      }
      ctx.fillStyle = hubGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowColor = "transparent";

      // Play icon triangle
      ctx.fillStyle = "#ffffff";
      const triSize = 8;
      ctx.beginPath();
      ctx.moveTo(center - triSize * 0.6, center - triSize - 2);
      ctx.lineTo(center + triSize * 0.8, center - 2);
      ctx.lineTo(center - triSize * 0.6, center + triSize - 2);
      ctx.closePath();
      ctx.fill();

      // "QUAY" text
      ctx.font = "bold 8px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("QUAY", center, center + 14);

      ctx.restore();
      ctx.restore();
    },
    [players, type, size, buildWheelCache]
  );

  // Preload images
  useEffect(() => {
    players.forEach((player) => {
      if (!imageCache.current.has(player.id)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imageCache.current.set(player.id, img);
          wheelDirty.current = true;
          render(rotationRef.current);
        };
        img.src = player.image;
      }
    });
    render(rotationRef.current);
  }, [players, render]);

  // Handle spinning
  useEffect(() => {
    if (!spinning || players.length === 0) return;
    if (hasSpun.current) return;
    hasSpun.current = true;

    const segmentAngle = (2 * Math.PI) / players.length;
    const winnerIndex = Math.floor(Math.random() * players.length);
    const segmentCenterOffset = winnerIndex * segmentAngle + segmentAngle / 2;
    const fullSpins = (6 + Math.floor(Math.random() * 4)) * 2 * Math.PI;
    const jitter = (Math.random() * 0.5 - 0.25) * segmentAngle * 0.5;
    const targetRotation = rotationRef.current + fullSpins - segmentCenterOffset + jitter;

    const startRotation = rotationRef.current;
    const totalRotation = targetRotation - startRotation;
    const duration = 4500 + Math.random() * 2000;
    const startTime = performance.now();

    let lastSegment = -1;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);

      rotationRef.current = startRotation + totalRotation * eased;
      render(rotationRef.current);

      // Tick sound
      if (progress < 0.85 && players.length > 0) {
        const currentSegment = Math.floor(
          ((rotationRef.current % (2 * Math.PI)) + 4 * Math.PI) % (2 * Math.PI) / segmentAngle
        );
        if (lastSegment !== -1 && currentSegment !== lastSegment) {
          playTick();
        }
        lastSegment = currentSegment;
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Determine winner from ACTUAL final rotation (visual = logic)
        const finalRot = rotationRef.current;
        const normalizedAngle = (((-finalRot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
        const actualWinnerIndex = Math.floor(normalizedAngle / segmentAngle) % players.length;
        playWin();
        onSpinEnd?.(players[actualWinnerIndex]);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  // Reset hasSpun when not spinning
  useEffect(() => {
    if (!spinning) {
      hasSpun.current = false;
    }
  }, [spinning]);

  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio || 1, 2)); // Cap at 2x for mobile
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    wheelDirty.current = true;
    render(rotationRef.current);
  }, [dpr, size, render]);

  // Handle click on center hub to spin
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onSpin || spinning || players.length === 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const dist = Math.sqrt(x * x + y * y);
      // Click within center hub radius (35px)
      if (dist <= 35) {
        onSpin();
      }
    },
    [onSpin, spinning, players.length]
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      style={{ width: size, height: size, cursor: players.length > 0 && !spinning ? "pointer" : "default" }}
      className="rounded-full"
    />
  );
}

function playTick() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 600 + Math.random() * 400;
    osc.type = "sine";
    gain.gain.value = 0.03;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch {
    /* noop */
  }
}

function playWin() {
  try {
    const ctx = new AudioContext();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.value = 0.06;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3 + i * 0.15);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + 0.3 + i * 0.15);
    });
  } catch {
    /* noop */
  }
}
