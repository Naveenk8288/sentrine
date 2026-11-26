'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle2, Loader2, X } from 'lucide-react';
import type { InvestigationResult } from '@/lib/analysis/types';
import { dispatchAlertNotification } from '@/lib/client/sentinelClient';
import {
  OBSIDIAN_INPUT,
  OBSIDIAN_SUB_SURFACE,
  ViewfinderBrackets,
} from './ObsidianPrimitives';

interface AlertModalProps {
  open: boolean;
  investigation: InvestigationResult | null;
  onClose: () => void;
}

export default function AlertModal({
  open,
  investigation,
  onClose,
}: AlertModalProps) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ success: boolean; message: string } | null>(null);

  if (!open) return null;

  const anomaly = investigation?.anomaly;
  const topDelta = investigation?.topicDeltas[0];
  const topEvidence = investigation?.supportingReviews[0]?.review.reviewText;

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);

    try {
      const json = await dispatchAlertNotification({
        periodLabel: investigation?.targetPeriodLabel || 'Selected Period',
        anomalyType: anomaly?.type || 'SUSTAINED_DECLINE',
        severity: anomaly?.severity || 'MEDIUM',
        scoreDrop: anomaly?.scoreDrop ?? 0.35,
        negativeShareSurge: anomaly?.negativeShareIncreasePts ?? 22.0,
        topTopicDelta: topDelta
          ? `${topDelta.topic} ${topDelta.deltaPercentagePoints >= 0 ? '+' : ''}${topDelta.deltaPercentagePoints} pts`
          : 'Software/Updates',
        sampleEvidenceText: topEvidence || 'Customer complaints observed.',
        webhookUrl: webhookUrl.trim() || undefined,
        isTest: !anomaly,
      });
      setResponse(json);
    } catch (err: unknown) {
      setResponse({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send alert',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#080503]/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
    >
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-[#d4a55c]/30 bg-[#150f0b] p-5 pb-7 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:pb-5">
        <ViewfinderBrackets className="border-[#c9644c]/60" sizeClass="h-3.5 w-3.5" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="alert-modal-title"
              className="font-editorial flex items-center gap-2 text-lg font-bold text-[#faf5ee]"
            >
              <Bell className="h-5 w-5 text-[#d96b52]" />
              <span>Dispatch Anomaly Alert</span>
            </h2>
            <p className="mt-1 text-xs text-[#9b8a76]">
              Send a formatted Slack or Discord alert for{' '}
              <span className="font-semibold text-[#e6b86e]">
                {investigation?.targetPeriodLabel || 'latest anomaly'}
              </span>
              . Leave URL blank to test safely in simulation mode.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close alert modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#9b8a76] hover:bg-[#231910] hover:text-[#faf5ee]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleDispatch(e)} className="mt-4 space-y-4">
          <div className={`${OBSIDIAN_SUB_SURFACE} p-3 text-xs`}>
            <div className="flex justify-between py-0.5">
              <span className="text-[#9b8a76]">Classification</span>
              <span className="font-mono font-semibold text-[#e6b86e]">
                {anomaly ? `${anomaly.severity} · ${anomaly.type}` : 'TEST NOTIFICATION'}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[#9b8a76]">Primary Topic Shift</span>
              <span className="font-mono text-[#efe2d0]">
                {topDelta
                  ? `${topDelta.topic} (+${topDelta.deltaPercentagePoints} pts)`
                  : 'N/A'}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="webhook-url-input"
              className="block text-xs font-medium text-[#cbbba7]"
            >
              Slack or Discord Webhook URL (Optional)
            </label>
            <input
              id="webhook-url-input"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/... (optional)"
              className={`${OBSIDIAN_INPUT} mt-1.5 min-h-[44px] w-full px-3.5 py-2 text-base sm:text-sm`}
            />
          </div>

          {response && (
            <div
              className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
                response.success
                  ? 'border-[#8bb87e]/40 bg-[#8bb87e]/12 text-[#b2d9a5]'
                  : 'border-[#d96b52]/40 bg-[#d96b52]/12 text-[#f29b87]'
              }`}
            >
              {response.success && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{response.message}</span>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] rounded-lg border border-[#d4a55c]/28 bg-[#1b140e] px-4 py-2 text-sm font-medium text-[#e6d5bf] hover:bg-[#241a11]"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#e6b86e] px-4 py-2 text-sm font-semibold text-[#140e0a] hover:bg-[#f0c783] disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{webhookUrl.trim() ? 'Send Live Webhook' : 'Run Alert Simulation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
