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

  const [themeKey, setThemeKey] = useState(0);

  // Watch for theme changes to re-read CSS variables
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeKey((k) => k + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const colors = getWheelColors(type);
  const textColor = getTextColor(type);

  const draw = useCallback(
    (rotation: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const center = size / 2;
      const radius = size / 2 - 14;

      ctx.clearRect(0, 0, size * dpr, size * dpr);
      ctx.save();
      ctx.scale(dpr, dpr);

      if (players.length === 0) {
        // Empty state
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
        return;
      }

      const segmentAngle = (2 * Math.PI) / players.length;

      // Outer glow ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radius + 6, 0, 2 * Math.PI);
      ctx.strokeStyle = type === "male"
        ? "rgba(59, 130, 246, 0.12)"
        : "rgba(236, 72, 153, 0.12)";
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(rotation);

      players.forEach((player, i) => {
        const startAngle = i * segmentAngle - Math.PI / 2;
        const endAngle = startAngle + segmentAngle;
        const midAngle = startAngle + segmentAngle / 2;

        // Draw segment
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();

        // Premium gradient fill
        const baseColor = colors[i % colors.length];
        const grad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
        grad.addColorStop(0, baseColor + "aa");
        grad.addColorStop(0.5, baseColor + "dd");
        grad.addColorStop(1, baseColor);
        ctx.fillStyle = grad;
        ctx.fill();

        // Segment divider
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Player photo — balanced for 7 segments
        const img = imageCache.current.get(player.id);
        if (img) {
          const photoRadius = Math.min(radius * 0.18, 36);
          const photoDist = radius * 0.58;
          const px = Math.cos(midAngle) * photoDist;
          const py = Math.sin(midAngle) * photoDist;

          ctx.save();

          // Photo glow
          ctx.shadowColor = "rgba(0,0,0,0.2)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 2;

          // Clip and draw
          ctx.beginPath();
          ctx.arc(px, py, photoRadius, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.clip();

          // Draw image covering the circle properly
          const imgAspect = img.naturalWidth / img.naturalHeight;
          let drawW = photoRadius * 2;
          let drawH = photoRadius * 2;
          let drawX = px - photoRadius;
          let drawY = py - photoRadius;
          if (imgAspect > 1) {
            drawW = drawH * imgAspect;
            drawX = px - drawW / 2;
          } else {
            drawH = drawW / imgAspect;
            drawY = py - drawH / 2;
          }
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();

          // Photo ring border
          ctx.beginPath();
          ctx.arc(px, py, photoRadius, 0, 2 * Math.PI);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
          ctx.lineWidth = 3.5;
          ctx.stroke();
        }

        // Name label — positioned near rim
        const nameDist = radius * 0.88;
        const nx = Math.cos(midAngle) * nameDist;
        const ny = Math.sin(midAngle) * nameDist;

        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate(midAngle + Math.PI / 2);
        if (midAngle > 0 && midAngle < Math.PI) {
          ctx.rotate(Math.PI);
        }

        // Text with dark outline for readability
        const fontSize = Math.min(13, 60 / players.length + 7);
        ctx.font = `bold ${fontSize}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Outline
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.strokeText(player.displayName, 0, 0);

        // Fill
        ctx.fillStyle = textColor;
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 3;
        ctx.fillText(player.displayName, 0, 0);
        ctx.restore();
      });

      ctx.restore();

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

      // Center hub — SPIN button
      const hubRadius = 32;
      ctx.save();

      // Hub shadow
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3;

      // Hub background gradient
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

      // Hub border ring
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.shadowColor = "transparent";

      // Play icon (triangle) + text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Draw play triangle
      const triSize = 8;
      ctx.beginPath();
      ctx.moveTo(center - triSize * 0.6, center - triSize - 2);
      ctx.lineTo(center + triSize * 0.8, center - 2);
      ctx.lineTo(center - triSize * 0.6, center + triSize - 2);
      ctx.closePath();
      ctx.fill();

      // "QUAY" text below
      ctx.font = "bold 8px system-ui";
      ctx.letterSpacing = "1px";
      ctx.fillText("QUAY", center, center + 14);

      ctx.restore();
    },
    [players, type, size, colors, textColor]
  );

  // Preload images
  useEffect(() => {
    players.forEach((player) => {
      if (!imageCache.current.has(player.id)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imageCache.current.set(player.id, img);
          draw(rotationRef.current);
        };
        img.src = player.image;
      }
    });
    draw(rotationRef.current);
  }, [players, draw]);

  // Handle spinning
  useEffect(() => {
    if (!spinning || players.length === 0) return;
    if (hasSpun.current) return;
    hasSpun.current = true;

    const winnerIndex = Math.floor(Math.random() * players.length);
    const segmentAngle = (2 * Math.PI) / players.length;
    // The pointer is at the TOP (-π/2). Segments are drawn starting at -π/2.
    // Segment i center angle (unrotated) = i * segmentAngle (from the -π/2 start).
    // To land segment i under the pointer, we need rotation such that:
    //   rotation + segmentCenter = multiple of 2π (bringing center to -π/2 position)
    // Since the wheel rotates clockwise, we need negative offset:
    const segmentCenterOffset = winnerIndex * segmentAngle + segmentAngle / 2;
    const fullSpins = (6 + Math.floor(Math.random() * 4)) * 2 * Math.PI;
    // Small random jitter within the segment bounds (±25% of half-segment)
    const jitter = (Math.random() * 0.5 - 0.25) * segmentAngle * 0.5;
    const targetRotation =
      rotationRef.current + fullSpins - segmentCenterOffset + jitter;

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
      draw(rotationRef.current);

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

  // Set DPR after mount
  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
  }, []);

  // Set canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    draw(rotationRef.current);
  }, [dpr, size, draw]);

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
