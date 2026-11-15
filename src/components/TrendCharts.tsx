'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, BarChart3, ShieldAlert } from 'lucide-react';
import type { TimeBucket } from '@/lib/analysis/types';
import { OBSIDIAN_SURFACE, ViewfinderBrackets } from './ObsidianPrimitives';

interface TrendChartsProps {
  buckets: TimeBucket[];
  selectedPeriodKey: string | null;
  onSelectPeriod: (periodKey: string) => void;
}

interface ChartDatum {
  periodKey: string;
  periodLabel: string;
  shortLabel: string;
  avgSentiment: number;
  bandBase: number;
  bandHeight: number;
  bandLower: number;
  bandUpper: number;
  totalCount: number;
  posShare: number;
  neuShare: number;
  mixedShare: number;
  negShare: number;
  isLowData: boolean;
  anomalyType?: 'SUSTAINED_DECLINE' | 'ISOLATED_EVENT' | 'VOLATILITY_SPIKE';
  anomalySeverity?: 'HIGH' | 'MEDIUM' | 'LOW';
  polarizationIndex: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartDatum }>;
  chartMode: 'sentiment' | 'composition';
}

function ChartTooltip({ active, payload, chartMode }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="max-w-[260px] rounded-xl border border-[#d4a55c]/35 bg-[#16100b]/96 p-3 text-xs shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-[#d4a55c]/18 pb-1.5">
        <span className="font-editorial font-bold text-[#faf5ee]">
          {item.periodLabel}
        </span>
        <span className="rounded border border-[#d4a55c]/25 bg-[#0e0a07] px-1.5 py-0.5 font-mono text-[11px] text-[#e6b86e]">
          n={item.totalCount}
        </span>
      </div>

      {chartMode === 'sentiment' ? (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-[#9b8a76]">Avg Sentiment</span>
            <span
              className={`font-mono font-semibold ${
                item.avgSentiment >= 0.2
                  ? 'text-[#a8d19b]'
                  : item.avgSentiment <= -0.05
                    ? 'text-[#f29b87]'
                    : 'text-[#e6b86e]'
              }`}
            >
              {item.avgSentiment >= 0 ? '+' : ''}
              {item.avgSentiment.toFixed(3)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#9b8a76]">95% Band</span>
            <span className="font-mono text-[#d8cab8]">
              [{item.bandLower.toFixed(2)}, {item.bandUpper.toFixed(2)}]
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#9b8a76]">Negative Share</span>
            <span className="font-mono text-[#f29b87]">
              {item.negShare.toFixed(1)}%
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-[#a8d19b]">Positive</span>
            <span className="font-mono font-semibold text-[#faf5ee]">
              {item.posShare.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#f5cb86]">Mixed</span>
            <span className="font-mono font-semibold text-[#faf5ee]">
              {item.mixedShare.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#9b8a76]">Neutral</span>
            <span className="font-mono font-semibold text-[#faf5ee]">
              {item.neuShare.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#f29b87]">Negative</span>
            <span className="font-mono font-semibold text-[#faf5ee]">
              {item.negShare.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between gap-4 border-t border-[#d4a55c]/15 pt-1">
            <span className="text-[#9b8a76]">Polarization Idx</span>
            <span className="font-mono text-[#e6b86e]">
              {item.polarizationIndex.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {item.isLowData && (
        <div className="mt-2 rounded-md border border-[#d4a55c]/20 bg-[#0e0a07] px-2 py-1 text-[11px] text-[#b6a592]">
          Low volume guard active — excluded from baseline alerts
        </div>
      )}

      {item.anomalyType && (
        <div
          className={`mt-2 rounded-md border px-2 py-1 text-[11px] font-medium ${
            item.anomalyType === 'SUSTAINED_DECLINE'
              ? 'border-[#d96b52]/40 bg-[#d96b52]/15 text-[#f29b87]'
              : 'border-[#e0a44b]/40 bg-[#e0a44b]/15 text-[#f5cb86]'
          }`}
        >
          {item.anomalyType === 'SUSTAINED_DECLINE'
            ? `${item.anomalySeverity} Sustained Decline`
            : 'Isolated Negative Event'}
          {' · Click to inspect'}
        </div>
      )}
    </div>
  );
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: ChartDatum;
  selectedPeriodKey: string | null;
  onSelectPeriod: (periodKey: string) => void;
}

function SentimentDot({
  cx,
  cy,
  payload,
  selectedPeriodKey,
  onSelectPeriod,
}: CustomDotProps) {
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return null;
  const isSelected = payload.periodKey === selectedPeriodKey;
  const isSustained = payload.anomalyType === 'SUSTAINED_DECLINE';
  const isIsolated = payload.anomalyType === 'ISOLATED_EVENT';

  let fill = '#e6b86e';
  let stroke = '#0e0a07';
  let radius = isSelected ? 6.5 : 4.5;

  if (isSustained) {
    fill = '#d96b52';
    radius = isSelected ? 8 : 6.5;
  } else if (isIsolated) {
    fill = '#e5a446';
    radius = isSelected ? 7.5 : 6;
  } else if (payload.isLowData) {
    fill = '#7c6d5c';
    radius = isSelected ? 6 : 4;
  }

  if (isSelected) {
    stroke = '#faf5ee';
  }

  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelectPeriod(payload.periodKey)}
    >
      {(isSustained || isSelected) && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 5}
          fill={
            isSustained ? 'rgba(217, 107, 82, 0.24)' : 'rgba(230, 184, 110, 0.24)'
          }
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
    </g>
  );
}

export default function TrendCharts({
  buckets,
  selectedPeriodKey,
  onSelectPeriod,
}: TrendChartsProps) {
  const [chartMode, setChartMode] = useState<'sentiment' | 'composition'>('sentiment');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const data: ChartDatum[] = useMemo(
    () =>
      buckets.map((b) => {
        const lower = Math.max(-1, b.confidenceBand.lower);
        const upper = Math.min(1, b.confidenceBand.upper);
        const shortLabel = b.periodLabel.split(' ')[0] || b.periodKey;
        return {
          periodKey: b.periodKey,
          periodLabel: b.periodLabel,
          shortLabel,
          avgSentiment: b.avgSentiment,
          bandBase: lower,
          bandHeight: Math.max(0, Number((upper - lower).toFixed(4))),
          bandLower: lower,
          bandUpper: upper,
          totalCount: b.totalCount,
          posShare: b.sentimentShares.positive,
          neuShare: b.sentimentShares.neutral,
          mixedShare: b.sentimentShares.mixed,
          negShare: b.sentimentShares.negative,
          isLowData: b.isLowData,
          anomalyType: b.anomaly?.type,
          anomalySeverity: b.anomaly?.severity,
          polarizationIndex: b.polarizationIndex,
        };
      }),
    [buckets]
  );

  return (
    <section
      id="trends-section"
      className={`relative ${OBSIDIAN_SURFACE} p-4 sm:p-5`}
    >
      <ViewfinderBrackets className="border-[#d4a55c]/45" sizeClass="h-3 w-3" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-editorial flex items-center gap-2 text-lg font-bold tracking-tight text-[#faf5ee] sm:text-xl">
            <Activity className="h-4 w-4 shrink-0 text-[#e6b86e]" />
            <span>Sentiment Trajectory &amp; Anomaly Signals</span>
          </h2>
          <p className="mt-0.5 text-xs text-[#9b8a76]">
            Tap any point or period chip below to isolate root causes and customer quotes.
          </p>
        </div>

        <div className="inline-flex self-start rounded-lg border border-[#d4a55c]/22 bg-[#0e0a07] p-1">
          <button
            type="button"
            onClick={() => setChartMode('sentiment')}
            className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-medium transition ${
              chartMode === 'sentiment'
                ? 'bg-[#e6b86e] font-semibold text-[#140e0a] shadow-sm'
                : 'text-[#b6a592] hover:text-[#faf5ee]'
            }`}
          >
            Sentiment Score
          </button>
          <button
            type="button"
            onClick={() => setChartMode('composition')}
            className={`flex min-h-[34px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              chartMode === 'composition'
                ? 'bg-[#e6b86e] font-semibold text-[#140e0a] shadow-sm'
                : 'text-[#b6a592] hover:text-[#faf5ee]'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Mix &amp; Polarity</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#b6a592]">
        {chartMode === 'sentiment' ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e6b86e]" />
              Avg Sentiment (-1 to +1)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#e6b86e]/25 ring-1 ring-[#e6b86e]/50" />
              95% Confidence Band
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#d96b52]" />
              Sustained Decline
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e5a446]" />
              Isolated Event
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#7c6d5c]" />
              Low Volume
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#8bb87e]" />
              Positive %
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#e0a44b]" />
              Mixed %
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#7d6d5c]" />
              Neutral %
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#d96b52]" />
              Negative %
            </span>
          </>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="mt-4 h-[250px] w-full sm:h-[310px]">
        {!mounted ? (
          <div className="h-full w-full animate-pulse rounded-xl bg-[#1d150f]" />
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#d4a55c]/25 text-sm text-[#9b8a76]">
            No reviews match the current filters.
          </div>
        ) : chartMode === 'sentiment' ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 12, right: 12, left: -18, bottom: 4 }}
              onClick={(state) => {
                const idx =
                  typeof state?.activeTooltipIndex === 'number'
                    ? state.activeTooltipIndex
                    : -1;
                const clicked = idx >= 0 ? data[idx] : undefined;
                if (clicked) onSelectPeriod(clicked.periodKey);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,165,92,0.12)" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 11, fill: '#9b8a76' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(212,165,92,0.22)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[-1, 1]}
                ticks={[-1, -0.5, 0, 0.5, 1]}
                tick={{ fontSize: 11, fill: '#9b8a76' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip chartMode="sentiment" />} />
              <ReferenceLine
                y={0}
                stroke="rgba(212,165,92,0.35)"
                strokeDasharray="4 4"
              />
              <Area
                type="monotone"
                dataKey="bandBase"
                stackId="band"
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="bandHeight"
                stackId="band"
                stroke="none"
                fill="rgba(230, 184, 110, 0.14)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="avgSentiment"
                stroke="#e6b86e"
                strokeWidth={2.5}
                activeDot={{
                  r: 7,
                  strokeWidth: 2,
                  stroke: '#faf5ee',
                  fill: '#e6b86e',
                }}
                dot={(dotProps) => (
                  <SentimentDot
                    key={`dot-${dotProps.payload?.periodKey ?? dotProps.index}`}
                    cx={dotProps.cx}
                    cy={dotProps.cy}
                    payload={dotProps.payload}
                    selectedPeriodKey={selectedPeriodKey}
                    onSelectPeriod={onSelectPeriod}
                  />
                )}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 12, right: 12, left: -18, bottom: 4 }}
              onClick={(state) => {
                const idx =
                  typeof state?.activeTooltipIndex === 'number'
                    ? state.activeTooltipIndex
                    : -1;
                const clicked = idx >= 0 ? data[idx] : undefined;
                if (clicked) onSelectPeriod(clicked.periodKey);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,165,92,0.12)" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 11, fill: '#9b8a76' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(212,165,92,0.22)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#9b8a76' }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <Tooltip content={<ChartTooltip chartMode="composition" />} />
              <Bar dataKey="posShare" stackId="mix" fill="#8bb87e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="mixedShare" stackId="mix" fill="#e0a44b" />
              <Bar dataKey="neuShare" stackId="mix" fill="#7d6d5c" />
              <Bar dataKey="negShare" stackId="mix" fill="#d96b52" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Mobile-friendly & keyboard-accessible Period Selector Strip */}
      {data.length > 0 && (
        <div className="mt-4 border-t border-[#d4a55c]/15 pt-3">
          <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-[#9b8a76]">
            <span>Select Period to Inspect ({data.length})</span>
            <span>Tap chip to jump</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.map((item) => {
              const isSelected = item.periodKey === selectedPeriodKey;
              const isSustained = item.anomalyType === 'SUSTAINED_DECLINE';
              const isIsolated = item.anomalyType === 'ISOLATED_EVENT';

              return (
                <button
                  key={item.periodKey}
                  type="button"
                  onClick={() => onSelectPeriod(item.periodKey)}
                  className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    isSelected
                      ? 'border-[#e6b86e] bg-[#e6b86e] font-semibold text-[#140e0a] shadow-sm'
                      : isSustained
                        ? 'border-[#d96b52]/45 bg-[#d96b52]/12 text-[#f29b87] hover:bg-[#d96b52]/20'
                        : isIsolated
                          ? 'border-[#e0a44b]/45 bg-[#e0a44b]/12 text-[#f5cb86] hover:bg-[#e0a44b]/20'
                          : 'border-[#d4a55c]/22 bg-[#1c140e] text-[#d6c7b4] hover:border-[#e6b86e]/45 hover:text-[#faf5ee]'
                  }`}
                >
                  {isSustained && <ShieldAlert className="h-3.5 w-3.5 shrink-0" />}
                  {isIsolated && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                  <span>{item.periodLabel}</span>
                  <span
                    className={`font-mono text-[10px] ${
                      isSelected ? 'text-[#2e2016]' : 'opacity-75'
                    }`}
                  >
                    ({item.totalCount})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
