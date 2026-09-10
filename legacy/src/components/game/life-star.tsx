"use client";

import { useEffect, useRef, useState } from "react";

export interface LifeStarAxis {
  domain: string;
  label: string;
  /** 0..max */
  value: number;
  color: string;
}

export interface LifeStarProps {
  axes: LifeStarAxis[];
  max: number;
  size?: number;
  /** Which axis (by domain key) is currently selected, if any. */
  selected?: string | null;
  onSelectAxis?: (domain: string) => void;
}

/**
 * The 8-axis radial. Purely presentational — it takes real values as props
 * and draws them; it does not know or care where the numbers came from.
 * Draws itself once on mount over ~1.2s (a stroke-dashoffset reveal plus a
 * fill fade); prefers-reduced-motion is handled globally in
 * game-tokens.css, which forces all transitions in .game-shell to ~0s, so
 * this component needs no reduced-motion branch of its own.
 */
export function LifeStar({ axes, max, size = 320, selected, onSelectAxis }: LifeStarProps) {
  const pathRef = useRef<SVGPolygonElement>(null);
  const [drawn, setDrawn] = useState(false);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 36; // leave room for labels

  const points = axes.map((axis, i) => {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / axes.length);
    const frac = max > 0 ? Math.min(1, Math.max(0, axis.value / max)) : 0;
    return {
      x: cx + Math.cos(angle) * r * frac,
      y: cy + Math.sin(angle) * r * frac,
      axisX: cx + Math.cos(angle) * r,
      axisY: cy + Math.sin(angle) * r,
      labelX: cx + Math.cos(angle) * (r + 24),
      labelY: cy + Math.sin(angle) * (r + 24),
      angle,
      axis,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const length = el.getTotalLength();
    el.style.transition = "none";
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    // Force layout, then trigger the transition on the next frame.
    el.getBoundingClientRect();
    requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 1.2s ease-out";
      el.style.strokeDashoffset = "0";
      setDrawn(true);
    });
  }, [axes.map((a) => a.value).join(",")]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Life star: your progress across all eight domains"
      className="mx-auto"
    >
      {/* Web rings */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={axes
            .map((_, i) => {
              const angle = -Math.PI / 2 + i * ((2 * Math.PI) / axes.length);
              return `${cx + Math.cos(angle) * r * f},${cy + Math.sin(angle) * r * f}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgb(var(--g-surface-hi))"
          strokeWidth={1}
        />
      ))}

      {/* Axis spokes */}
      {points.map((p) => (
        <line
          key={p.axis.domain}
          x1={cx}
          y1={cy}
          x2={p.axisX}
          y2={p.axisY}
          stroke="rgb(var(--g-surface-hi))"
          strokeWidth={1}
        />
      ))}

      {/* Filled value shape */}
      <polygon
        points={polygonPoints}
        fill="rgb(var(--g-violet) / 0.22)"
        stroke="none"
        style={{ opacity: drawn ? 1 : 0, transition: "opacity 1.2s ease-out" }}
      />
      <polygon ref={pathRef} points={polygonPoints} fill="none" stroke="rgb(var(--g-cyan))" strokeWidth={2} />

      {/* Vertex dots + labels */}
      {points.map((p) => (
        <g key={p.axis.domain}>
          <circle
            cx={p.x}
            cy={p.y}
            r={4}
            fill={p.axis.color}
            style={{ opacity: drawn ? 1 : 0, transition: "opacity 1.2s ease-out" }}
          />
          <text
            x={p.labelX}
            y={p.labelY}
            textAnchor={Math.abs(p.labelX - cx) < 4 ? "middle" : p.labelX > cx ? "start" : "end"}
            dominantBaseline="middle"
            onClick={onSelectAxis ? () => onSelectAxis(p.axis.domain) : undefined}
            className="select-none font-game-body text-[11px] font-semibold uppercase tracking-wide"
            fill={selected === p.axis.domain ? "rgb(var(--g-cyan))" : "rgb(var(--g-text-dim))"}
            style={{ cursor: onSelectAxis ? "pointer" : "default" }}
          >
            {p.axis.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
