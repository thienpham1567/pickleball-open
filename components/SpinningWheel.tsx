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

    // Draw segments
    players.forEach((player, i) => {
      const startAngle = i * segmentAngle - Math.PI / 2;
      const endAngle = startAngle + segmentAngle;
      const midAngle = startAngle + segmentAngle / 2;
      const color = colors[i % colors.length];

      // Segment fill — alternating opacity for depth
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();

      const grad = ctx.createRadialGradient(center, center, radius * 0.25, center, center, radius);
      const brighten = i % 2 === 0 ? "cc" : "ff";
      grad.addColorStop(0, color + "44");
      grad.addColorStop(0.5, color + "88");
      grad.addColorStop(1, color + brighten);
      ctx.fillStyle = grad;
      ctx.fill();

      // Segment divider line
      ctx.beginPath();
      ctx.moveTo(center, center);
      const edgeX = center + Math.cos(startAngle) * radius;
      const edgeY = center + Math.sin(startAngle) * radius;
      ctx.lineTo(edgeX, edgeY);
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Player photo — centered in segment
      const img = imageCache.current.get(player.id);
      const photoRadius = Math.min(radius * 0.2, 38);
      const photoDist = radius * 0.55;
      const px = Math.cos(midAngle) * photoDist;
      const py = Math.sin(midAngle) * photoDist;

      if (img) {
        // White circle background (shadow)
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(center + px, center + py, photoRadius + 1, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();

        // Clip and draw photo
        ctx.save();
        ctx.beginPath();
        ctx.arc(center + px, center + py, photoRadius - 1, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.clip();

        const imgAspect = img.naturalWidth / img.naturalHeight;
        let sw = photoRadius * 2, sh = photoRadius * 2;
        if (imgAspect > 1) sw = sh * imgAspect;
        else sh = sw / imgAspect;
        ctx.drawImage(img, center + px - sw / 2, center + py - sh / 2, sw, sh);
        ctx.restore();
      }

      // Name badge — pill near outer edge
      const badgeDist = radius * 0.78;
      const bx = Math.cos(midAngle) * badgeDist;
      const by = Math.sin(midAngle) * badgeDist;

      ctx.save();
      ctx.translate(center + bx, center + by);
      let textAngle = midAngle;
      if (textAngle > Math.PI / 2 && textAngle < (3 * Math.PI) / 2) textAngle += Math.PI;
      if (textAngle < -Math.PI / 2 && textAngle > (-3 * Math.PI) / 2) textAngle += Math.PI;
      ctx.rotate(textAngle);

      // Measure text for pill
      ctx.font = "bold 11px system-ui";
      const textWidth = ctx.measureText(player.displayName).width;
      const pillW = textWidth + 12;
      const pillH = 18;

      // Pill background
      const pillRadius = pillH / 2;
      ctx.beginPath();
      ctx.moveTo(-pillW / 2 + pillRadius, -pillH / 2);
      ctx.lineTo(pillW / 2 - pillRadius, -pillH / 2);
      ctx.arc(pillW / 2 - pillRadius, 0, pillRadius, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-pillW / 2 + pillRadius, pillH / 2);
      ctx.arc(-pillW / 2 + pillRadius, 0, pillRadius, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Name text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(player.displayName, 0, 0.5);
      ctx.restore();
    });

    // Outer metallic ring
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, 2 * Math.PI);
    const ringGrad = ctx.createLinearGradient(0, 0, size, size);
    if (type === "male") {
      ringGrad.addColorStop(0, "rgba(59, 130, 246, 0.5)");
      ringGrad.addColorStop(0.5, "rgba(147, 197, 253, 0.7)");
      ringGrad.addColorStop(1, "rgba(59, 130, 246, 0.5)");
    } else {
      ringGrad.addColorStop(0, "rgba(236, 72, 153, 0.5)");
      ringGrad.addColorStop(0.5, "rgba(251, 146, 191, 0.7)");
      ringGrad.addColorStop(1, "rgba(236, 72, 153, 0.5)");
    }
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner highlight ring
    ctx.beginPath();
    ctx.arc(center, center, radius - 4, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Decorative PEGS around outer edge (game show style)
    const pegCount = players.length * 3; // 3 pegs per segment
    const pegRadius = 3.5;
    for (let i = 0; i < pegCount; i++) {
      const pegAngle = (i / pegCount) * 2 * Math.PI - Math.PI / 2;
      const pegX = center + Math.cos(pegAngle) * (radius - 1);
      const pegY = center + Math.sin(pegAngle) * (radius - 1);

      ctx.beginPath();
      ctx.arc(pegX, pegY, pegRadius, 0, 2 * Math.PI);
      // Alternate peg colors for sparkle
      if (i % 3 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
      } else {
        ctx.fillStyle = type === "male" ? "rgba(147,197,253,0.6)" : "rgba(251,146,191,0.6)";
      }
      ctx.fill();
    }

    // Pointer triangle at top (drawn on cached canvas so it rotates — we'll also draw a static one on render)
    // We skip it here since pointer should be static

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

      // 3D Pointer triangle at top — prominent game show style
      const pointerW = 20;
      const pointerH = 28;
      const pointerTip = 10; // how far it overlaps into the wheel
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.moveTo(center, pointerTip);
      ctx.lineTo(center - pointerW / 2, pointerTip - pointerH);
      ctx.lineTo(center + pointerW / 2, pointerTip - pointerH);
      ctx.closePath();

      // Pointer gradient
      const ptrGrad = ctx.createLinearGradient(center, 0, center, pointerTip);
      if (type === "male") {
        ptrGrad.addColorStop(0, "#1e40af");
        ptrGrad.addColorStop(1, "#3b82f6");
      } else {
        ptrGrad.addColorStop(0, "#9d174d");
        ptrGrad.addColorStop(1, "#ec4899");
      }
      ctx.fillStyle = ptrGrad;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      // Center hub (not rotated, drawn on top)
      const hubRadius = 36;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 3;

      // Hub outer ring
      ctx.beginPath();
      ctx.arc(center, center, hubRadius + 3, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fill();

      // Hub main circle
      ctx.beginPath();
      ctx.arc(center, center, hubRadius, 0, 2 * Math.PI);
      const hubGrad = ctx.createRadialGradient(center - 8, center - 8, 0, center, center, hubRadius);
      if (type === "male") {
        hubGrad.addColorStop(0, "#93c5fd");
        hubGrad.addColorStop(0.4, "#3b82f6");
        hubGrad.addColorStop(1, "#1d4ed8");
      } else {
        hubGrad.addColorStop(0, "#fbcfe8");
        hubGrad.addColorStop(0.4, "#ec4899");
        hubGrad.addColorStop(1, "#be185d");
      }
      ctx.fillStyle = hubGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowColor = "transparent";

      // Play icon — larger triangle
      ctx.fillStyle = "#ffffff";
      const triSize = 10;
      ctx.beginPath();
      ctx.moveTo(center - triSize * 0.5, center - triSize - 1);
      ctx.lineTo(center + triSize * 0.9, center - 1);
      ctx.lineTo(center - triSize * 0.5, center + triSize - 1);
      ctx.closePath();
      ctx.fill();

      // "QUAY" text
      ctx.font = "bold 9px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("QUAY", center, center + 16);

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
