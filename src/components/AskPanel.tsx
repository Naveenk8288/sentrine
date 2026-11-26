'use client';

import React, { useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import type { FeedbackReview } from '@/lib/analysis/types';
import { askSentinelQuestion } from '@/lib/client/sentinelClient';
import {
  OBSIDIAN_INPUT,
  OBSIDIAN_SUB_SURFACE,
  OBSIDIAN_SURFACE,
  ViewfinderBrackets,
} from './ObsidianPrimitives';
import type { AskApiResponse } from './types';

interface AskPanelProps {
  customReviews: FeedbackReview[] | null;
}

const STARTER_QUESTIONS = [
  'Why did EchoPulse Pro sentiment drop?',
  'What happened with Lumina Glow delivery?',
  'Show me mixed sentiment complaints',
];

export default function AskPanel({ customReviews }: AskPanelProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskApiResponse | null>(null);

  const submitQuery = async (textToAsk: string) => {
    const trimmed = textToAsk.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setLoading(true);
    setError(null);

    try {
      const json = await askSentinelQuestion(trimmed, customReviews);
      setResult(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to process question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="ask-section"
      className={`relative ${OBSIDIAN_SURFACE} p-4 sm:p-5`}
    >
      <ViewfinderBrackets className="border-[#d4a55c]/45" sizeClass="h-3 w-3" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-editorial flex items-center gap-2 text-lg font-bold tracking-tight text-[#faf5ee] sm:text-xl">
            <Sparkles className="h-4 w-4 shrink-0 text-[#e6b86e]" />
            <span>Ask SentinelAI</span>
          </h2>
          <p className="mt-0.5 text-xs text-[#9b8a76]">
            Ask natural-language questions grounded strictly in customer feedback citations.
          </p>
        </div>
      </div>

      {/* Quick question chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {STARTER_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={loading}
            onClick={() => void submitQuery(q)}
            className="min-h-[34px] rounded-lg border border-[#d4a55c]/24 bg-[#1c140e] px-3 py-1.5 text-left text-xs font-medium text-[#e6d5bf] transition hover:border-[#e6b86e]/60 hover:bg-[#261b12] disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input form with 16px mobile font-size to prevent iOS/Android auto-zoom */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitQuery(query);
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about a product, firmware bug, delivery delay, or rating drop..."
          className={`${OBSIDIAN_INPUT} min-h-[44px] w-full flex-1 px-3.5 py-2.5 text-base sm:text-sm`}
        />
        <button
          type="submit"
          disabled={loading || query.trim() === ''}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[#e6b86e] px-4 py-2.5 text-sm font-semibold text-[#140e0a] shadow-[0_0_16px_rgba(230,184,110,0.2)] transition hover:bg-[#f0c783] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span>Ask</span>
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded-xl border border-[#d96b52]/40 bg-[#d96b52]/10 p-3 text-xs text-[#f29b87]">
          {error}
        </div>
      )}

      {result && (
        <div className={`mt-4 ${OBSIDIAN_SUB_SURFACE} border-l-2 border-l-[#e6b86e] p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold uppercase tracking-[0.14em] text-[#e6b86e]">
              Grounded Answer
            </span>
            <span className="rounded border border-[#d4a55c]/25 bg-[#0e0a07] px-2 py-0.5 text-[#cbbba7]">
              {result.isOfflineFallback ? 'Extractive Grounded Mode' : 'Gemini AI Grounded'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[#f2e9dc]">
            {result.answer}
          </p>

          {result.citedReviews.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-[#d4a55c]/16 pt-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8a76]">
                Cited Customer Reviews ({result.citedReviews.length})
              </div>
              {result.citedReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-lg border border-[#d4a55c]/18 bg-[#120d09] p-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                    <span className="font-mono font-semibold text-[#e6b86e]">
                      {rev.id} · {rev.product}
                    </span>
                    <span className="text-[#9b8a76]">
                      {rev.date} · {rev.sentimentLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-[#dfd2c0]">&ldquo;{rev.reviewText}&rdquo;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
