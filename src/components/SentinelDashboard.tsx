'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  ChevronDown,
  ChevronUp,
  Database,
  Filter,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Upload,
} from 'lucide-react';
import type {
  FeedbackReview,
  InvestigationResult,
} from '@/lib/analysis/types';
import {
  fetchInvestigationData,
  fetchTrendsData,
  resetDatasetOnServer,
} from '@/lib/client/sentinelClient';
import AlertModal from './AlertModal';
import AskPanel from './AskPanel';
import InvestigationPanel from './InvestigationPanel';
import {
  OBSIDIAN_INPUT,
  OBSIDIAN_SUB_SURFACE,
  OBSIDIAN_SURFACE,
  SignalConstellationSVG,
  ViewfinderBrackets,
} from './ObsidianPrimitives';
import TrendCharts from './TrendCharts';
import type {
  GranularityMode,
  TrendsApiResponse,
} from './types';
import UploadModal from './UploadModal';

export default function SentinelDashboard() {
  // Dataset state (null = built-in demo_feedback.csv on server)
  const [customReviews, setCustomReviews] = useState<FeedbackReview[] | null>(null);
  const [datasetLabel, setDatasetLabel] = useState('Demo Feedback (12 Weeks)');

  // Filter state
  const [period, setPeriod] = useState<GranularityMode>('weekly');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minVolumeThreshold, setMinVolumeThreshold] = useState(5);
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  // Data state
  const [trends, setTrends] = useState<TrendsApiResponse | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [investigationError, setInvestigationError] = useState<string | null>(null);

  // Modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategories.length > 0) count++;
    if (selectedProducts.length > 0) count++;
    if (startDate || endDate) count++;
    if (minVolumeThreshold !== 5) count++;
    return count;
  }, [selectedCategories, selectedProducts, startDate, endDate, minVolumeThreshold]);

  // Fetch trends when filters or dataset change
  useEffect(() => {
    let cancelled = false;

    const loadTrends = async () => {
      setTrendsLoading(true);
      setTrendsError(null);

      try {
        const json = await fetchTrendsData({
          customReviews,
          period,
          categories: selectedCategories,
          products: selectedProducts,
          startDate,
          endDate,
          minVolumeThreshold,
        });
        if (cancelled) return;

        setTrends(json);

        // Keep selected period if still valid; otherwise auto-pick strongest anomaly or latest bucket
        setSelectedPeriodKey((prev) => {
          if (prev && json.buckets.some((b) => b.periodKey === prev)) {
            return prev;
          }
          const highSustained = json.buckets.find(
            (b) => b.anomaly?.type === 'SUSTAINED_DECLINE' && b.anomaly.severity === 'HIGH'
          );
          const anySustained = json.buckets.find(
            (b) => b.anomaly?.type === 'SUSTAINED_DECLINE'
          );
          const anyAnomaly = json.buckets.find((b) => b.anomaly !== undefined);
          return (
            highSustained?.periodKey ||
            anySustained?.periodKey ||
            anyAnomaly?.periodKey ||
            json.buckets[json.buckets.length - 1]?.periodKey ||
            null
          );
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setTrendsError(
            err instanceof Error ? err.message : 'Unable to load dashboard trends'
          );
        }
      } finally {
        if (!cancelled) setTrendsLoading(false);
      }
    };

    void loadTrends();
    return () => {
      cancelled = true;
    };
  }, [
    customReviews,
    period,
    selectedCategories,
    selectedProducts,
    startDate,
    endDate,
    minVolumeThreshold,
  ]);

  // Fetch period investigation whenever selectedPeriodKey or filters change
  useEffect(() => {
    if (!selectedPeriodKey) {
      return;
    }

    let cancelled = false;

    const loadInvestigation = async () => {
      setInvestigationLoading(true);
      setInvestigationError(null);

      try {
        const json = await fetchInvestigationData({
          periodKey: selectedPeriodKey,
          customReviews,
          period,
          categories: selectedCategories,
          products: selectedProducts,
          startDate,
          endDate,
          minVolumeThreshold,
        });
        if (!cancelled && json.data) {
          setInvestigation(json.data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setInvestigationError(
            err instanceof Error ? err.message : 'Investigation failed'
          );
        }
      } finally {
        if (!cancelled) setInvestigationLoading(false);
      }
    };

    void loadInvestigation();
    return () => {
      cancelled = true;
    };
  }, [
    selectedPeriodKey,
    customReviews,
    period,
    selectedCategories,
    selectedProducts,
    startDate,
    endDate,
    minVolumeThreshold,
  ]);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setSelectedProducts([]);
  }, []);

  const toggleProduct = useCallback((prod: string) => {
    setSelectedProducts((prev) =>
      prev.includes(prod) ? prev.filter((p) => p !== prod) : [...prev, prod]
    );
  }, []);

  const resetAllFilters = useCallback(() => {
    setSelectedCategories([]);
    setSelectedProducts([]);
    setStartDate('');
    setEndDate('');
    setMinVolumeThreshold(5);
    setPeriod('weekly');
  }, []);

  const handleResetDataset = async () => {
    await resetDatasetOnServer();
    setCustomReviews(null);
    setDatasetLabel('Demo Feedback (12 Weeks)');
    setSelectedPeriodKey(null);
    resetAllFilters();
  };

  const handleInspectAnomaly = (periodKey: string) => {
    setSelectedPeriodKey(periodKey);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      document
        .getElementById('investigation-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeInvestigation = selectedPeriodKey ? investigation : null;
  const kpis = trends?.kpis;
  const lowDataCount = useMemo(
    () => (trends?.buckets ? trends.buckets.filter((b) => b.isLowData).length : 0),
    [trends]
  );

  return (
    <div className="min-h-screen bg-[#0e0a07] text-[#faf5ee]">
      {/* Sticky Minimal Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#d4a55c]/18 bg-[#0e0a07]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Concentric Target Logo Emblem */}
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e6b86e]/40 bg-[#18110b] shadow-[0_0_16px_rgba(230,184,110,0.2)]">
              <span className="h-5 w-5 rounded-full border border-[#e6b86e]/55 flex items-center justify-center">
                <Activity className="h-3 w-3 text-[#e6b86e]" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-editorial truncate text-base font-bold tracking-tight text-[#faf5ee] sm:text-lg">
                  Sentinel<span className="text-[#e6b86e]">AI</span>
                </span>
                <span className="hidden rounded border border-[#c9644c]/40 bg-[#c9644c]/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e5927c] sm:inline-flex">
                  Sentiment Radar
                </span>
              </div>
              <p className="truncate text-[11px] text-[#9b8a76]">
                <span className="inline-flex items-center gap-1">
                  <Database className="h-3 w-3 shrink-0 text-[#d4a55c]" />
                  <span>{datasetLabel}</span>
                  {trends && (
                    <span>
                      · {trends.filters.minDate} to {trends.filters.maxDate}
                    </span>
                  )}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {customReviews && (
              <button
                type="button"
                onClick={() => void handleResetDataset()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#d4a55c]/30 bg-[#1a120c] px-3 py-1.5 text-xs font-medium text-[#e6d5bf] transition hover:border-[#e6b86e]/60 hover:bg-[#231810]"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#e6b86e]" />
                <span className="hidden sm:inline">Reset Demo</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setAlertOpen(true)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#c9644c]/40 bg-[#1b120d] px-3 py-1.5 text-xs font-medium text-[#f2cfc5] transition hover:border-[#d96b52] hover:bg-[#271711]"
            >
              <Bell className="h-3.5 w-3.5 text-[#d96b52]" />
              <span className="hidden sm:inline">Alerts</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#e6b86e] bg-[#e6b86e] px-3.5 py-1.5 text-xs font-semibold text-[#140e0a] shadow-[0_0_18px_rgba(230,184,110,0.22)] transition hover:bg-[#f0c783]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload CSV</span>
            </button>
          </div>
        </div>

        {/* Mobile Quick-Jump Strip */}
        <div className="border-t border-[#d4a55c]/14 bg-[#120c08]/95 px-4 py-2 lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <button
              type="button"
              onClick={() => scrollToSection('trends-section')}
              className="flex-1 rounded-lg border border-[#d4a55c]/22 bg-[#1a130d] px-2.5 py-1.5 text-center text-xs font-medium text-[#f0dec6] transition hover:border-[#e6b86e]/50"
            >
              Trends
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('investigation-section')}
              className="flex-1 rounded-lg border border-[#d4a55c]/22 bg-[#1a130d] px-2.5 py-1.5 text-center text-xs font-medium text-[#f0dec6] transition hover:border-[#e6b86e]/50"
            >
              Root Cause
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('ask-section')}
              className="flex-1 rounded-lg border border-[#d4a55c]/22 bg-[#1a130d] px-2.5 py-1.5 text-center text-xs font-medium text-[#f0dec6] transition hover:border-[#e6b86e]/50"
            >
              Ask AI
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        {/* Editorial Obsidian Stage + Viewfinder Brackets + KPI Deck */}
        <section className="relative overflow-hidden rounded-2xl border border-[#d4a55c]/22 bg-[#120d09] px-4 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] sm:px-8 sm:py-8">
          <ViewfinderBrackets />

          {/* Ambient Radial Radar Halo & Subtle Horizon Wireframe */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(ellipse_62%_58%_at_50%_68%,rgba(230,184,110,0.16),rgba(196,112,68,0.08)_44%,transparent_75%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[62%] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e6b86e]/12 shadow-[0_0_50px_rgba(230,184,110,0.08)] sm:h-64 sm:w-64"
          >
            <div className="absolute inset-6 rounded-full border border-[#e6b86e]/16" />
            <div className="absolute inset-14 rounded-full border border-[#e6b86e]/22 bg-[#e6b86e]/[0.04]" />
          </div>

          {/* Faint Architectural Grid Tiles */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 top-1/2 hidden grid-cols-6 gap-3 opacity-25 sm:grid"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg border border-[#d4a55c]/20 bg-[#1a120c]/20"
              />
            ))}
          </div>

          {/* Centered Editorial Masthead */}
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#d47a5e] sm:text-[11px]">
              Customer Feedback Intelligence
            </p>
            <h1 className="font-editorial mt-2 text-3xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              <span className="block text-[#e6b86e]">Sentiment Signals,</span>
              <span className="block text-[#faf5ee]">Decoded Early.</span>
            </h1>

            {/* Glowing Amber Horizontal Divider */}
            <div
              aria-hidden="true"
              className="mx-auto mt-3.5 h-[2px] w-44 rounded-full bg-gradient-to-r from-[#d4a55c]/30 via-[#e6b86e] to-[#d4a55c]/30 shadow-[0_0_12px_rgba(230,184,110,0.5)] sm:w-64"
            />

            <div className="relative mt-2">
              <SignalConstellationSVG />
              <p className="-mt-7 text-xs font-light leading-relaxed text-[#d3c3b0] sm:-mt-8 sm:text-sm">
                Continuous anomaly detection, topic shift isolation, and grounded review
                citations across{' '}
                <span className="font-medium text-[#faf5ee]">
                  {kpis ? kpis.totalReviews.toLocaleString() : '—'}
                </span>{' '}
                verified customer reviews.
              </p>
            </div>
          </div>

          {/* Top-Capped Editorial KPI Cards */}
          <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {/* Card 1: Reviews Analyzed */}
            <div className="rounded-lg border border-[#d4a55c]/25 border-t-2 border-t-[#e6b86e] bg-[#16100b]/88 p-4 backdrop-blur-md transition hover:border-[#e6b86e]/45">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[#9b8a76]">
                <span>Analyzed</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#e6b86e]" />
              </div>
              <div className="font-editorial mt-2 text-2xl font-bold tracking-tight text-[#e6b86e] sm:text-4xl">
                {trendsLoading && !kpis ? '—' : kpis?.totalReviews.toLocaleString() ?? 0}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-[#b6a592]">
                Across {trends?.buckets.length ?? 0} {period} periods
              </p>
            </div>

            {/* Card 2: Avg Sentiment */}
            <div className="rounded-lg border border-[#d4a55c]/25 border-t-2 border-t-[#e6b86e] bg-[#16100b]/88 p-4 backdrop-blur-md transition hover:border-[#e6b86e]/45">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[#9b8a76]">
                <span>Avg Score</span>
                {kpis && kpis.sentimentTrendDelta < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 text-[#d96b52]" />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5 text-[#9bc48c]" />
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="font-editorial text-2xl font-bold tracking-tight text-[#faf5ee] sm:text-4xl">
                  {kpis
                    ? `${kpis.avgSentiment >= 0 ? '+' : ''}${kpis.avgSentiment.toFixed(2)}`
                    : '—'}
                </span>
                {kpis && (
                  <span
                    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                      kpis.sentimentTrendDelta >= 0
                        ? 'border-[#8bb87e]/40 bg-[#8bb87e]/12 text-[#a8d19b]'
                        : 'border-[#d96b52]/40 bg-[#d96b52]/14 text-[#f29b87]'
                    }`}
                  >
                    {kpis.sentimentTrendDelta >= 0 ? '+' : ''}
                    {kpis.sentimentTrendDelta.toFixed(2)} PoP
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-[#b6a592]">
                VADER index (-1.00 to +1.00)
              </p>
            </div>

            {/* Card 3: Net Sentiment */}
            <div className="rounded-lg border border-[#d4a55c]/25 border-t-2 border-t-[#e6b86e] bg-[#16100b]/88 p-4 backdrop-blur-md transition hover:border-[#e6b86e]/45">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[#9b8a76]">
                <span>Net Balance</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#9bc48c]" />
              </div>
              <div className="font-editorial mt-2 text-2xl font-bold tracking-tight text-[#e6b86e] sm:text-4xl">
                {kpis
                  ? `${kpis.netSentimentScore >= 0 ? '+' : ''}${kpis.netSentimentScore.toFixed(1)}`
                  : '—'}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-[#b6a592]">
                {kpis
                  ? `${kpis.positiveShare}% Positive · ${kpis.negativeShare}% Negative`
                  : 'Positive minus Negative share'}
              </p>
            </div>

            {/* Card 4: Anomalies Detected (Terracotta top bar matching focal poster card) */}
            <div className="rounded-lg border border-[#c9644c]/30 border-t-2 border-t-[#d96b52] bg-[#16100b]/88 p-4 backdrop-blur-md transition hover:border-[#d96b52]/55">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[#e08b74]">
                <span>Anomalies</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#d96b52] shadow-[0_0_8px_#d96b52]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-editorial text-2xl font-bold tracking-tight text-[#e07a60] sm:text-4xl">
                  {kpis ? kpis.activeAnomalyCount : '—'}
                </span>
                <span className="text-xs text-[#b6a592]">sustained</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-[#b6a592]">
                {kpis
                  ? `${kpis.isolatedEventCount} isolated event(s) flagged`
                  : 'Sustained decline alerts'}
              </p>
            </div>
          </div>
        </section>

        {/* Global Controls & Filter Matrix */}
        <section className={`${OBSIDIAN_SURFACE} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Period Granularity */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b6a592]">
                <Calendar className="h-3.5 w-3.5 text-[#e6b86e]" />
                <span>Window</span>
              </span>
              <div className="inline-flex rounded-lg border border-[#d4a55c]/20 bg-[#0e0a07] p-1">
                {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setPeriod(mode);
                      setSelectedPeriodKey(null);
                    }}
                    className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                      period === mode
                        ? 'bg-[#e6b86e] font-semibold text-[#140e0a] shadow-xs'
                        : 'text-[#b6a592] hover:text-[#faf5ee]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#e6b86e]/30 bg-[#1f160f] px-2.5 py-1 text-xs font-medium text-[#e6b86e] transition hover:bg-[#2a1d13]"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset ({activeFilterCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpenMobile((v) => !v)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#d4a55c]/25 bg-[#1b140e] px-3 py-1.5 text-xs font-medium text-[#efe2d0] lg:hidden"
              >
                <Filter className="h-3.5 w-3.5 text-[#e6b86e]" />
                <span>
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </span>
                {filtersOpenMobile ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Expandable Filter Matrix */}
          <div
            className={`${
              filtersOpenMobile ? 'mt-4 block' : 'hidden'
            } space-y-3 border-t border-[#d4a55c]/15 pt-4 lg:mt-4 lg:block`}
          >
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-4">
              {/* Categories */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8a76]">
                  Categories
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(trends?.filters.categories || []).map((cat) => {
                    const active = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`min-h-[32px] rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          active
                            ? 'border-[#e6b86e] bg-[#e6b86e] text-[#140e0a]'
                            : 'border-[#d4a55c]/22 bg-[#1c140e] text-[#d6c7b4] hover:border-[#e6b86e]/50 hover:text-[#faf5ee]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Products */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8a76]">
                  Products
                </label>
                <div className="flex max-h-[84px] flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {(trends?.filters.products || []).map((prod) => {
                    const active = selectedProducts.includes(prod);
                    return (
                      <button
                        key={prod}
                        type="button"
                        onClick={() => toggleProduct(prod)}
                        className={`min-h-[32px] rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          active
                            ? 'border-[#e6b86e] bg-[#e6b86e] text-[#140e0a]'
                            : 'border-[#d4a55c]/22 bg-[#1c140e] text-[#d6c7b4] hover:border-[#e6b86e]/50 hover:text-[#faf5ee]'
                        }`}
                      >
                        {prod}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="start-date"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8a76]"
                  >
                    Start Date
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    min={trends?.filters.minDate}
                    max={trends?.filters.maxDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`${OBSIDIAN_INPUT} min-h-[38px] w-full px-2.5 py-1.5 text-base sm:text-xs`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="end-date"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8a76]"
                  >
                    End Date
                  </label>
                  <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    min={trends?.filters.minDate}
                    max={trends?.filters.maxDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`${OBSIDIAN_INPUT} min-h-[38px] w-full px-2.5 py-1.5 text-base sm:text-xs`}
                  />
                </div>
              </div>

              {/* Noise Guard Threshold */}
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b8a76]">
                  <span className="inline-flex items-center gap-1">
                    <SlidersHorizontal className="h-3 w-3 text-[#e6b86e]" />
                    <span>Min Volume Guard</span>
                  </span>
                  <span className="font-mono text-[#e6b86e]">
                    ≥ {minVolumeThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={minVolumeThreshold}
                  onChange={(e) => setMinVolumeThreshold(Number(e.target.value))}
                  aria-label="Minimum reviews per period threshold"
                  className="mt-2 h-2 w-full cursor-pointer accent-[#e6b86e]"
                />
                <p className="mt-1 text-[11px] text-[#9b8a76]">
                  Periods below threshold marked Low Volume ({lowDataCount} suppressed).
                </p>
              </div>
            </div>
          </div>
        </section>

        {trendsError && (
          <div className="rounded-xl border border-[#d96b52]/40 bg-[#d96b52]/10 p-4 text-sm text-[#f4a490]">
            {trendsError}
          </div>
        )}

        {/* Active Anomalies Strip */}
        {trends && trends.anomalies.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d47a5e]">
                <AlertTriangle className="h-3.5 w-3.5 text-[#d96b52]" />
                <span>Flagged Anomaly Periods ({trends.anomalies.length})</span>
              </h2>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">
              {trends.anomalies.map((anom) => {
                const isSelected = selectedPeriodKey === anom.periodKey;
                const isSustained = anom.type === 'SUSTAINED_DECLINE';
                const bucketLabel =
                  trends.buckets.find((b) => b.periodKey === anom.periodKey)?.periodLabel ||
                  anom.periodKey;

                return (
                  <div
                    key={anom.id}
                    className={`min-w-[275px] flex-1 rounded-xl border border-t-2 p-4 transition lg:min-w-0 ${
                      isSelected
                        ? isSustained
                          ? 'border-[#d96b52]/65 border-t-[#d96b52] bg-[#241410] ring-1 ring-[#d96b52]/30'
                          : 'border-[#e0a44b]/65 border-t-[#e0a44b] bg-[#221a10] ring-1 ring-[#e0a44b]/30'
                        : `${OBSIDIAN_SUB_SURFACE} ${
                            isSustained ? 'border-t-[#d96b52]/75' : 'border-t-[#e0a44b]/75'
                          }`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-editorial text-base font-bold text-[#faf5ee]">
                        {bucketLabel}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          isSustained
                            ? 'border-[#d96b52]/40 bg-[#d96b52]/15 text-[#f29b87]'
                            : 'border-[#e0a44b]/40 bg-[#e0a44b]/15 text-[#f5cb86]'
                        }`}
                      >
                        {isSustained ? `${anom.severity} Sustained` : 'Isolated Event'}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#cbbba7]">
                      {anom.summary}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-[#9b8a76]">
                        Drop: -{anom.scoreDrop.toFixed(2)} · Neg: +
                        {anom.negativeShareIncreasePts.toFixed(1)} pts
                      </span>
                      <button
                        type="button"
                        onClick={() => handleInspectAnomaly(anom.periodKey)}
                        className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-[#e6b86e] text-[#140e0a]'
                            : 'border border-[#d4a55c]/35 bg-[#120d09] text-[#e6b86e] hover:border-[#e6b86e] hover:bg-[#1e150e]'
                        }`}
                      >
                        {isSelected ? 'Inspecting' : 'Investigate'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Main Analytical Grid */}
        {trendsLoading && !trends ? (
          <div className={`${OBSIDIAN_SURFACE} flex min-h-[320px] items-center justify-center`}>
            <div className="flex items-center gap-2.5 text-sm text-[#c2b19d]">
              <Loader2 className="h-5 w-5 animate-spin text-[#e6b86e]" />
              <span>Computing sentiment buckets &amp; anomaly baseline...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
            <div className="min-w-0 space-y-5 lg:col-span-7">
              <TrendCharts
                buckets={trends?.buckets || []}
                selectedPeriodKey={selectedPeriodKey}
                onSelectPeriod={(key) => setSelectedPeriodKey(key)}
              />
              <AskPanel customReviews={customReviews} />
            </div>

            <div className="min-w-0 lg:col-span-5">
              <InvestigationPanel
                investigation={activeInvestigation}
                loading={investigationLoading}
                error={investigationError}
                onTriggerAlert={() => setAlertOpen(true)}
              />
            </div>
          </div>
        )}

        {/* Editorial Footer Signature */}
        <footer className="relative pt-4 pb-6 text-center">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-px w-full max-w-md bg-gradient-to-r from-transparent via-[#d4a55c]/30 to-transparent"
          />
          <p className="font-editorial text-sm italic text-[#9e8c77]">
            Noise is raw. Anticipation is the intelligence.
          </p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#6d5f4f]">
            SENTINELAI · CONTINUOUS SENTIMENT RADAR
          </p>
        </footer>
      </main>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadSuccess={(reviews, label) => {
          setCustomReviews(reviews);
          setDatasetLabel(`${label} (${reviews.length} reviews)`);
          setSelectedPeriodKey(null);
          resetAllFilters();
        }}
      />

      <AlertModal
        open={alertOpen}
        investigation={activeInvestigation}
        onClose={() => setAlertOpen(false)}
      />
    </div>
  );
}
