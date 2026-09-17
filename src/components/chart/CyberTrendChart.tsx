import React, { useState } from "react";

export interface ChartDataPoint {
  timestamp: number;
  price: number;
  label?: string;
  blockNumber?: string;
}

export interface CyberTrendChartProps {
  data: ChartDataPoint[];
  height?: number;
  strokeColor?: string;
  gradientId?: string;
  token0Symbol?: string;
  token1Symbol?: string;
}

/**
 * High-performance, lightweight SVG Cyberpunk Area & Line Chart
 */
export const CyberTrendChart: React.FC<CyberTrendChartProps> = ({
  data,
  height = 180,
  strokeColor = "#00e5ff",
  gradientId = "cyberAreaGradient",
  token0Symbol = "ACP",
  token1Symbol = "USDT",
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-cyber-textMuted border border-dashed border-slate-800 rounded-xl"
        style={{ height }}
      >
        <span>暂无足够 24 小时交易历史数据点（至少需要 2 个采样点）</span>
      </div>
    );
  }

  // Calculate min, max with 5% padding
  const prices = data.map((d) => d.price);
  let minPrice = Math.min(...prices);
  let maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    minPrice *= 0.95;
    maxPrice *= 1.05;
  } else {
    const range = maxPrice - minPrice;
    minPrice = Math.max(0, minPrice - range * 0.05);
    maxPrice = maxPrice + range * 0.05;
  }

  const width = 500;
  const paddingX = 20;
  const paddingY = 20;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Map coordinates
  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * chartWidth;
    const y =
      paddingY +
      chartHeight -
      ((d.price - minPrice) / (maxPrice - minPrice)) * chartHeight;
    return { x, y, data: d };
  });

  // Construct SVG path string
  const linePath = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, "");

  // Construct Area closed path for gradient fill
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaPath = `${linePath} L ${lastPoint.x},${height - paddingY} L ${firstPoint.x},${height - paddingY} Z`;

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>

          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal background grid lines */}
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = paddingY + chartHeight * ratio;
          return (
            <line
              key={ratio}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#1e293b"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          );
        })}

        {/* Gradient Area Fill */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Glowing Stroke Line */}
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          filter="url(#neonGlow)"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Data Points */}
        {points.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r="4"
            className="cursor-pointer transition-all hover:r-6 fill-slate-950 stroke-cyber-cyan stroke-2"
            onMouseEnter={() => setHoveredPoint(pt.data)}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}
      </svg>

      {/* Hover Tooltip Overlay */}
      {hoveredPoint && (
        <div className="absolute top-2 right-3 bg-cyber-card/90 border border-cyber-border rounded-lg px-2.5 py-1 text-[11px] shadow-lg backdrop-blur-sm pointer-events-none font-mono text-slate-200">
          <div>
            价格: <span className="text-cyber-cyan font-bold">{hoveredPoint.price.toFixed(4)}</span> {token1Symbol}/{token0Symbol}
          </div>
          <div className="text-[10px] text-cyber-textMuted">
            {new Date(hoveredPoint.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};
