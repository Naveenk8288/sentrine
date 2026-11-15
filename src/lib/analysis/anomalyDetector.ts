import { AnomalyRecord, FeedbackReview, TimeBucket } from './types';

export interface AnomalyDetectionConfig {
  minVolumeThreshold?: number; // default 5 (Edge Case 1)
  minNegativeReviewsForSustained?: number; // default 3 (Edge Case 3)
  scoreDropThreshold?: number; // default 0.25
  negativeShareSurgeThreshold?: number; // default 20 percentage points
}

/**
 * Detects significant changes and anomalies across time periods, strictly handling
 * Edge Case 1 (low volume), Edge Case 2 (polarization), and Edge Case 3 (isolated events).
 */
export function detectChanges(
  buckets: TimeBucket[],
  reviewsByPeriod?: Map<string, FeedbackReview[]>,
  config: AnomalyDetectionConfig = {}
): TimeBucket[] {
  const {
    minVolumeThreshold = 5,
    minNegativeReviewsForSustained = 3,
    scoreDropThreshold = 0.25,
    negativeShareSurgeThreshold = 20,
  } = config;

  if (!buckets || buckets.length === 0) return [];

  // Deep clone to avoid mutating input directly
  const enrichedBuckets: TimeBucket[] = buckets.map((b) => ({ ...b }));

  // Keep track of reliable previous periods for baseline (up to 4 prior periods)
  const reliableHistory: TimeBucket[] = [];

  for (let i = 0; i < enrichedBuckets.length; i++) {
    const current = enrichedBuckets[i];

    // Edge Case 1: Enforce minimum review count per period
    if (current.totalCount < minVolumeThreshold) {
      current.isLowData = true;
      // Do NOT raise anomaly or use as reliable baseline
      continue;
    }

    // Need at least one prior reliable period to calculate change
    if (reliableHistory.length === 0) {
      reliableHistory.push(current);
      continue;
    }

    // Compute baseline from the last reliable period or moving average of last up to 4 reliable periods
    const lastReliable = reliableHistory[reliableHistory.length - 1];
    const baselineBuckets = reliableHistory.slice(-4);
    const baselineAvgSentiment =
      baselineBuckets.reduce((sum, b) => sum + b.avgSentiment, 0) / baselineBuckets.length;
    const baselineNegativeShare =
      baselineBuckets.reduce((sum, b) => sum + b.sentimentShares.negative, 0) / baselineBuckets.length;

    // Change calculations:
    // Drop is baseline - current (positive number means dropped)
    const scoreDropVsLast = Number((lastReliable.avgSentiment - current.avgSentiment).toFixed(4));
    const scoreDropVsBaseline = Number((baselineAvgSentiment - current.avgSentiment).toFixed(4));
    const effectiveDrop = Math.max(scoreDropVsLast, scoreDropVsBaseline);

    // Negative share surge in percentage points
    const negShareSurgeVsLast = Number(
      (current.sentimentShares.negative - lastReliable.sentimentShares.negative).toFixed(2)
    );
    const negShareSurgeVsBaseline = Number(
      (current.sentimentShares.negative - baselineNegativeShare).toFixed(2)
    );
    const effectiveNegSurge = Math.max(negShareSurgeVsLast, negShareSurgeVsBaseline);

    const isScoreDrop = effectiveDrop >= scoreDropThreshold;
    const isNegSurge = effectiveNegSurge >= negativeShareSurgeThreshold;

    if (isScoreDrop || isNegSurge) {
      const negativeCount = current.sentimentCounts.negative;
      
      // Determine severity
      let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (effectiveDrop >= 0.4 || effectiveNegSurge >= 35) {
        severity = 'HIGH';
      } else if (effectiveDrop >= 0.25 || effectiveNegSurge >= 20) {
        severity = 'MEDIUM';
      }

      // Edge Case 3: Require minimum negative reviews (default 3) before flagging sustained decline
      if (negativeCount < minNegativeReviewsForSustained) {
        // Classify as ISOLATED_EVENT
        let drivingReviewId: string | undefined;
        let drivingReviewText: string | undefined;

        if (reviewsByPeriod && reviewsByPeriod.has(current.periodKey)) {
          const periodReviews = reviewsByPeriod.get(current.periodKey)!;
          // Find the most negative review
          const worst = [...periodReviews].sort((a, b) => a.compoundScore - b.compoundScore)[0];
          if (worst) {
            drivingReviewId = worst.id;
            drivingReviewText = worst.reviewText;
          }
        }

        const anomaly: AnomalyRecord = {
          id: `anomaly-${current.periodKey}`,
          periodKey: current.periodKey,
          type: 'ISOLATED_EVENT',
          severity: 'LOW',
          scoreDrop: Math.max(0, effectiveDrop),
          negativeShareIncreasePts: Math.max(0, effectiveNegSurge),
          drivingReviewId,
          drivingReviewText,
          summary: `Isolated negative event driven by ${negativeCount} review(s) (not a systemic trend).`,
          baselinePeriodKey: lastReliable.periodKey,
        };

        current.anomaly = anomaly;
      } else {
        // Sustained systemic anomaly
        const anomaly: AnomalyRecord = {
          id: `anomaly-${current.periodKey}`,
          periodKey: current.periodKey,
          type: 'SUSTAINED_DECLINE',
          severity,
          scoreDrop: Math.max(0, effectiveDrop),
          negativeShareIncreasePts: Math.max(0, effectiveNegSurge),
          summary: `Significant sentiment decline of ${Math.max(0, effectiveDrop).toFixed(2)} pts with negative share rising +${Math.max(0, effectiveNegSurge).toFixed(1)} pts.`,
          baselinePeriodKey: lastReliable.periodKey,
        };

        current.anomaly = anomaly;
      }
    }

    // Add current period to reliable history
    reliableHistory.push(current);
  }

  return enrichedBuckets;
}
