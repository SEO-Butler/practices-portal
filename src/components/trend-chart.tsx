"use client";

import { useRef, useState } from "react";

// Small SVG line chart for vitals over time. Palette (validated for CVD
// separation + contrast on the light surface): series 1 blue, series 2
// green. Text/grid use neutral ink tokens, never series colors.

export const SERIES_COLORS = ["#2a78d6", "#008300"];

export interface TrendSeries {
  name: string;
  points: Array<{ t: number; v: number }>; // t = epoch ms, ascending
}

interface Props {
  title: string;
  unit: string;
  series: TrendSeries[];
  /** Normal reference band (e.g. HR 50–100); open bounds clamp to domain. */
  band?: { low: number | null; high: number | null } | null;
  height?: number;
}

const W = 560;
const PAD = { top: 14, right: 14, bottom: 22, left: 40 };

export function TrendChart({ title, unit, series, band, height = 170 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const H = height;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length < 2) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="mt-4 pb-4 text-center text-sm text-slate-400">
          Not enough readings yet — a trend appears after two or more.
        </p>
      </div>
    );
  }

  const ts = allPoints.map((p) => p.t);
  const vs = allPoints.map((p) => p.v);
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  let vMin = Math.min(...vs, band?.low ?? Infinity);
  let vMax = Math.max(...vs, band?.high ?? -Infinity);
  const vPad = Math.max((vMax - vMin) * 0.12, 1);
  vMin -= vPad;
  vMax += vPad;

  const x = (t: number) =>
    PAD.left + (tMax === tMin ? plotW / 2 : ((t - tMin) / (tMax - tMin)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

  const timestamps = [...new Set(ts)].sort((a, b) => a - b);
  const hovered =
    hoverT === null
      ? null
      : timestamps.reduce((best, t) =>
          Math.abs(t - hoverT) < Math.abs(best - hoverT) ? t : best,
        );

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setHoverT(tMin + ((px - PAD.left) / plotW) * (tMax - tMin));
  }

  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  const bandLow = band?.low ?? vMin;
  const bandHigh = band?.high ?? vMax;
  const showBand = band && (band.low !== null || band.high !== null);

  const hoverValues = hovered
    ? series
        .map((s, i) => ({
          name: s.name,
          color: SERIES_COLORS[i],
          point: s.points.find((p) => p.t === hovered),
        }))
        .filter((h) => h.point)
    : [];
  const tooltipOnLeft = hovered !== null && x(hovered) > W * 0.62;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-slate-700">
          {title} <span className="font-normal text-slate-400">({unit})</span>
        </p>
        {series.length > 1 && (
          <span className="flex items-center gap-3 text-xs text-slate-500">
            {series.map((s, i) => (
              <span key={s.name} className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: SERIES_COLORS[i] }}
                />
                {s.name}
              </span>
            ))}
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${title} trend chart`}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverT(null)}
      >
        {showBand && (
          <rect
            x={PAD.left}
            y={y(bandHigh)}
            width={plotW}
            height={Math.max(y(bandLow) - y(bandHigh), 0)}
            fill="#f1f5f9"
          />
        )}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + plotH * f}
            y2={PAD.top + plotH * f}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {hovered !== null && (
          <line
            x1={x(hovered)}
            x2={x(hovered)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {series.map((s, i) => (
          <g key={s.name}>
            <polyline
              fill="none"
              stroke={SERIES_COLORS[i]}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.points.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")}
            />
            {s.points.map((p) => (
              <circle
                key={p.t}
                cx={x(p.t)}
                cy={y(p.v)}
                r={hovered === p.t ? 5 : 4}
                fill="#ffffff"
                stroke={SERIES_COLORS[i]}
                strokeWidth="2"
              />
            ))}
          </g>
        ))}

        {/* y-axis min/max, x-axis first/last — recessive ink */}
        <text x={PAD.left - 6} y={y(vMax) + 4} textAnchor="end" fontSize="10" fill="#64748b">
          {Math.round(vMax * 10) / 10}
        </text>
        <text x={PAD.left - 6} y={y(vMin) + 4} textAnchor="end" fontSize="10" fill="#64748b">
          {Math.round(vMin * 10) / 10}
        </text>
        <text x={PAD.left} y={H - 6} fontSize="10" fill="#94a3b8">
          {fmtDate(tMin)}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="10" fill="#94a3b8">
          {fmtDate(tMax)}
        </text>

        {hovered !== null && hoverValues.length > 0 && (
          <g>
            <rect
              x={tooltipOnLeft ? x(hovered) - 148 : x(hovered) + 8}
              y={PAD.top}
              width={140}
              height={16 + hoverValues.length * 14}
              rx={4}
              fill="#0f172a"
              opacity="0.92"
            />
            <text
              x={tooltipOnLeft ? x(hovered) - 140 : x(hovered) + 16}
              y={PAD.top + 13}
              fontSize="10"
              fill="#cbd5e1"
            >
              {new Date(hovered).toLocaleString(undefined, {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </text>
            {hoverValues.map((h, i) => (
              <text
                key={h.name}
                x={tooltipOnLeft ? x(hovered) - 140 : x(hovered) + 16}
                y={PAD.top + 27 + i * 14}
                fontSize="10"
                fill="#ffffff"
              >
                {h.name}: {h.point!.v} {unit}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
