'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  Flame,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
} from 'lucide-react';
import type { InvestigationResult } from '@/lib/analysis/types';
import {
  OBSIDIAN_SUB_SURFACE,
  OBSIDIAN_SURFACE,
  ViewfinderBrackets,
} from './ObsidianPrimitives';

interface InvestigationPanelProps {
  investigation: InvestigationResult | null;
  loading: boolean;
  error: string | null;
  onTriggerAlert: (investigation: InvestigationResult) => void;
}

function sentimentBadgeClass(label: string): string {
  switch (label) {
    case 'Positive':
      return 'border-[#8bb87e]/40 bg-[#8bb87e]/14 text-[#b2d9a5]';
    case 'Negative':
      return 'border-[#d96b52]/40 bg-[#d96b52]/14 text-[#f29b87]';
    case 'Mixed':
      return 'border-[#e0a44b]/40 bg-[#e0a44b]/14 text-[#f5cb86]';
    default:
      return 'border-[#d4a55c]/25 bg-[#1b140e] text-[#b6a592]';
  }
}

export default function InvestigationPanel({
  investigation,
  loading,
  error,
  onTriggerAlert,
}: InvestigationPanelProps) {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null);

  const visibleReviews = useMemo(() => {
    if (!investigation) return [];
    if (!selectedTerm) return investigation.supportingReviews;
    const kw = selectedTerm.toLowerCase();
    return investigation.supportingReviews.filter((item) =>
      item.review.reviewText.toLowerCase().includes(kw)
    );
  }, [investigation, selectedTerm]);

  const handleJumpToCitation = (revId: string) => {
    setSelectedTerm(null);
    setHighlightedReviewId(revId);
    const el = document.getElementById(`evidence-${revId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <section
      id="investigation-section"
      className={`relative ${OBSIDIAN_SURFACE} p-4 sm:p-5`}
    >
      <ViewfinderBrackets className="border-[#c9644c]/50" sizeClass="h-3 w-3" />

      <div className="flex flex-col gap-3 border-b border-[#d4a55c]/16 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-editorial flex items-center gap-2 text-lg font-bold tracking-tight text-[#faf5ee] sm:text-xl">
              <Search className="h-4 w-4 shrink-0 text-[#e6b86e]" />
              <span>Root Cause Investigation</span>
            </h2>
            {investigation?.anomaly && (
              <span
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  investigation.anomaly.type === 'SUSTAINED_DECLINE'
                    ? 'border-[#d96b52]/45 bg-[#d96b52]/15 text-[#f29b87]'
                    : 'border-[#e0a44b]/45 bg-[#e0a44b]/15 text-[#f5cb86]'
                }`}
              >
                {investigation.anomaly.type === 'SUSTAINED_DECLINE' ? (
                  <ShieldAlert className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {investigation.anomaly.type === 'SUSTAINED_DECLINE'
                  ? `${investigation.anomaly.severity} Anomaly`
                  : 'Isolated Event'}
              </span>
            )}
          </div>
          {investigation ? (
            <p className="mt-1 text-xs text-[#9b8a76]">
              Inspecting{' '}
              <span className="font-semibold text-[#e6b86e]">
                {investigation.targetPeriodLabel}
              </span>{' '}
              ({investigation.totalReviewsInPeriod} reviews)
              {investigation.baselinePeriods.length > 0
                ? ` vs ${investigation.baselinePeriods.length}-period baseline`
                : ' · Initial baseline period'}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[#9b8a76]">
              Select any period on the chart to inspect topic shifts and supporting reviews.
            </p>
          )}
        </div>

        {investigation && (
          <button
            type="button"
            onClick={() => onTriggerAlert(investigation)}
            className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#d4a55c]/30 bg-[#1c140e] px-3 py-1.5 text-xs font-medium text-[#f2dfc7] transition hover:border-[#e6b86e]/60 hover:bg-[#271b13]"
          >
            <Bell className="h-3.5 w-3.5 text-[#d96b52]" />
            <span>{investigation.anomaly ? 'Alert Team' : 'Test Alert'}</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 py-10 text-sm text-[#b6a592]">
          <Loader2 className="h-6 w-6 animate-spin text-[#e6b86e]" />
          <span>Analyzing topic shifts, distinctive terms &amp; grounded evidence...</span>
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-[#d96b52]/40 bg-[#d96b52]/10 p-4 text-sm text-[#f4a490]">
          {error}
        </div>
      ) : !investigation ? (
        <div className="flex min-h-[200px] items-center justify-center text-sm text-[#9b8a76]">
          No period selected.
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {/* AI / Extractive Diagnosis */}
          <div className="rounded-xl border border-[#d4a55c]/30 border-l-2 border-l-[#e6b86e] bg-gradient-to-br from-[#21170f] via-[#17110c] to-[#120d09] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#e6b86e]">
                <Bot className="h-4 w-4" />
                Grounded Cause Synthesis
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded border border-[#d4a55c]/25 bg-[#0e0a07] px-2 py-0.5 text-[11px] font-medium text-[#cbbba7]">
                  {investigation.aiExplanation.isOfflineFallback
                    ? 'Deterministic Extractive'
                    : 'Gemini AI Grounded'}
                </span>
                <span
                  className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                    investigation.aiExplanation.confidence === 'HIGH'
                      ? 'border-[#8bb87e]/40 bg-[#8bb87e]/15 text-[#b2d9a5]'
                      : investigation.aiExplanation.confidence === 'MEDIUM'
                        ? 'border-[#e0a44b]/40 bg-[#e0a44b]/15 text-[#f5cb86]'
                        : 'border-[#d4a55c]/25 bg-[#1b140e] text-[#b6a592]'
                  }`}
                >
                  {investigation.aiExplanation.confidence} Confidence
                </span>
              </div>
            </div>

            <p className="mt-2.5 text-sm leading-relaxed text-[#f2e9dc]">
              {investigation.aiExplanation.likelyCause}
            </p>

            {investigation.aiExplanation.eventDetectiveHypothesis && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#e0a44b]/35 bg-[#e0a44b]/10 p-3 text-xs leading-relaxed text-[#f6d9a3]">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#e6b86e]" />
                <div>
                  <span className="font-semibold text-[#e6b86e]">Event Detective: </span>
                  {investigation.aiExplanation.eventDetectiveHypothesis}
                </div>
              </div>
            )}

            {investigation.aiExplanation.citations.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#9b8a76]">
                  Cited Evidence:
                </span>
                {investigation.aiExplanation.citations.map((cid) => (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => handleJumpToCitation(cid)}
                    className="rounded border border-[#e6b86e]/35 bg-[#0e0a07] px-2 py-1 font-mono text-[11px] font-medium text-[#e6b86e] transition hover:border-[#e6b86e] hover:bg-[#231910]"
                  >
                    [{cid}]
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Topic Share Shifts */}
          <div>
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b8a76]">
              <Flame className="h-3.5 w-3.5 text-[#d96b52]" />
              <span>Topic Share Deltas (Pts vs Baseline)</span>
            </h3>
            <div className="mt-2.5 space-y-2">
              {investigation.topicDeltas.slice(0, 5).map((td) => {
                const positiveDelta = td.deltaPercentagePoints > 0;
                return (
                  <div
                    key={td.topic}
                    className={`${OBSIDIAN_SUB_SURFACE} p-2.5`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-medium text-[#faf5ee]">
                        <span>{td.topic}</span>
                        {td.isSurge && (
                          <span className="rounded border border-[#d96b52]/45 bg-[#d96b52]/18 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#f29b87]">
                            SURGE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-[#9b8a76]">
                          {td.baselineShare.toFixed(1)}% → {td.currentShare.toFixed(1)}%
                        </span>
                        <span
                          className={`font-semibold ${
                            td.isSurge
                              ? 'text-[#f29b87]'
                              : positiveDelta
                                ? 'text-[#e6b86e]'
                                : 'text-[#a8d19b]'
                          }`}
                        >
                          {positiveDelta ? '+' : ''}
                          {td.deltaPercentagePoints.toFixed(1)} pts
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#0e0a07]">
                      <div
                        className={`h-full rounded-full ${
                          td.isSurge
                            ? 'bg-[#d96b52]'
                            : positiveDelta
                              ? 'bg-[#e6b86e]'
                              : 'bg-[#8bb87e]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(4, td.currentShare))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distinctive Terms */}
          {investigation.distinctiveTerms.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b8a76]">
                  <Sparkles className="h-3.5 w-3.5 text-[#e6b86e]" />
                  <span>Emerging Terms (Tap to filter)</span>
                </h3>
                {selectedTerm && (
                  <button
                    type="button"
                    onClick={() => setSelectedTerm(null)}
                    className="text-xs font-medium text-[#e6b86e] hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {investigation.distinctiveTerms.map((term) => {
                  const active = selectedTerm === term.term;
                  return (
                    <button
                      key={term.term}
                      type="button"
                      onClick={() => setSelectedTerm(active ? null : term.term)}
                      className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                        active
                          ? 'border-[#e6b86e] bg-[#e6b86e] font-semibold text-[#140e0a]'
                          : 'border-[#d4a55c]/24 bg-[#1c140e] text-[#efe2d0] hover:border-[#e6b86e]/50'
                      }`}
                    >
                      <span className="font-medium">&ldquo;{term.term}&rdquo;</span>
                      <span
                        className={`font-mono text-[10px] ${
                          active ? 'text-[#2d1f14]' : 'text-[#9b8a76]'
                        }`}
                      >
                        {term.targetFrequency}% vs {term.baselineFrequency}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Supporting Evidence Reviews */}
          <div>
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b8a76]">
              <MessageSquareQuote className="h-3.5 w-3.5 text-[#e6b86e]" />
              <span>Supporting Customer Reviews ({visibleReviews.length})</span>
            </h3>

            {visibleReviews.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-[#d4a55c]/25 p-4 text-center text-xs text-[#9b8a76]">
                No top supporting reviews matched &ldquo;{selectedTerm}&rdquo;.
              </p>
            ) : (
              <div className="mt-2.5 space-y-2.5">
                {visibleReviews.map(({ review, matchedKeywords }) => {
                  const isHighlighted = highlightedReviewId === review.id;
                  return (
                    <article
                      key={review.id}
                      id={`evidence-${review.id}`}
                      className={`rounded-xl border p-3 transition ${
                        isHighlighted
                          ? 'border-[#e6b86e] bg-[#241a11] ring-2 ring-[#e6b86e]/25'
                          : 'border-[#d4a55c]/18 bg-[#120d09]/90'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-semibold text-[#e6b86e]">
                            {review.id}
                          </span>
                          <span className="text-[#6d5f4f]">·</span>
                          <span className="font-medium text-[#efe2d0]">
                            {review.product}
                          </span>
                          <span className="rounded border border-[#d4a55c]/20 bg-[#1d150f] px-1.5 py-0.5 text-[#b6a592]">
                            {review.topic}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {review.rating !== undefined && (
                            <span className="inline-flex items-center gap-0.5 font-mono text-[#e6b86e]">
                              <Star className="h-3 w-3 fill-current" />
                              {review.rating}
                            </span>
                          )}
                          <span
                            className={`rounded border px-2 py-0.5 font-medium ${sentimentBadgeClass(
                              review.sentimentLabel
                            )}`}
                          >
                            {review.sentimentLabel} ({review.compoundScore.toFixed(2)})
                          </span>
                        </div>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-[#e8dccb] sm:text-[13px]">
                        &ldquo;{review.reviewText}&rdquo;
                      </p>

                      {review.clauseScores && review.clauseScores.length > 1 && (
                        <div className="mt-2 space-y-1 rounded-lg border border-[#d4a55c]/14 bg-[#1a120d] p-2">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9b8a76]">
                            Clause Sentiment Breakdown
                          </div>
                          {review.clauseScores.map((cl, idx) => (
                            <div
                              key={`${review.id}-cl-${idx}`}
                              className="flex items-start justify-between gap-2 text-[11px]"
                            >
                              <span className="text-[#d6c7b4]">{cl.clause}</span>
                              <span
                                className={`shrink-0 font-mono font-semibold ${
                                  cl.score >= 0.25
                                    ? 'text-[#a8d19b]'
                                    : cl.score <= -0.25
                                      ? 'text-[#f29b87]'
                                      : 'text-[#9b8a76]'
                                }`}
                              >
                                {cl.score >= 0 ? '+' : ''}
                                {cl.score.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#7f6f5d]">
                        <span>{review.date}</span>
                        {matchedKeywords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {matchedKeywords.slice(0, 4).map((kw) => (
                              <span
                                key={kw}
                                className="inline-flex items-center gap-0.5 rounded border border-[#e6b86e]/25 bg-[#1e160f] px-1.5 py-0.5 text-[10px] font-medium text-[#e6b86e]"
                              >
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
