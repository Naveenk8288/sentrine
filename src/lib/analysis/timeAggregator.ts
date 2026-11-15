import {
  createEmptyTopicCounts,
  FeedbackReview,
  FeedbackTopic,
  FEEDBACK_TOPICS,
  TimeBucket,
} from './types';

function parseDateAsUTC(dateStr: string): Date | null {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function formatUTCDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns a deterministic UTC period key based on date and grouping mode.
 */
export function getPeriodKey(dateStr: string, mode: 'daily' | 'weekly' | 'monthly'): {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
} {
  const d = parseDateAsUTC(dateStr);
  if (!d) {
    return { key: 'invalid', label: 'Invalid', startDate: dateStr, endDate: dateStr };
  }

  if (mode === 'daily') {
    const key = formatUTCDate(d);
    const label = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return { key, label, startDate: key, endDate: key };
  }

  if (mode === 'monthly') {
    const year = d.getUTCFullYear();
    const monthIdx = d.getUTCMonth();
    const month = String(monthIdx + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    const firstDay = `${year}-${month}-01`;
    const lastDayDate = new Date(Date.UTC(year, monthIdx + 1, 0));
    const lastDay = formatUTCDate(lastDayDate);
    const label = d.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return { key, label, startDate: firstDay, endDate: lastDay };
  }

  // Weekly: Monday-based ISO week in UTC
  const day = d.getUTCDay();
  const diffToMonday = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diffToMonday));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));

  const startStr = formatUTCDate(monday);
  const endStr = formatUTCDate(sunday);

  // Compute ISO week number and ISO week-year in UTC
  const thursday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 3));
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const firstMonday = new Date(Date.UTC(isoYear, 0, 4 - jan4Day + 1));
  const weekNum = 1 + Math.round((monday.getTime() - firstMonday.getTime()) / 604800000);
  const key = `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
  const label = `W${weekNum} (${monday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })})`;

  return { key, label, startDate: startStr, endDate: endStr };
}

/**
 * Aggregates a list of reviews into time buckets.
 */
export function aggregateByPeriod(
  reviews: FeedbackReview[],
  mode: 'daily' | 'weekly' | 'monthly' = 'weekly',
  minVolumeThreshold: number = 5
): TimeBucket[] {
  if (!reviews || reviews.length === 0) return [];

  // Group by period key
  const bucketMap = new Map<string, {
    info: ReturnType<typeof getPeriodKey>;
    items: FeedbackReview[];
  }>();

  for (const r of reviews) {
    const info = getPeriodKey(r.date, mode);
    if (info.key === 'invalid') continue;

    if (!bucketMap.has(info.key)) {
      bucketMap.set(info.key, { info, items: [] });
    }
    bucketMap.get(info.key)!.items.push(r);
  }

  // Sort chronological by start date
  const sortedEntries = Array.from(bucketMap.entries()).sort(
    (a, b) => a[1].info.startDate.localeCompare(b[1].info.startDate)
  );

  return sortedEntries.map(([, { info, items }]) => {
    const totalCount = items.length;
    const isLowData = totalCount < minVolumeThreshold;

    let posCount = 0;
    let neuCount = 0;
    let negCount = 0;
    let mixedCount = 0;
    let totalCompound = 0;

    const topicCounts: Record<FeedbackTopic, number> = createEmptyTopicCounts();

    const scores: number[] = [];

    for (const r of items) {
      scores.push(r.compoundScore);
      totalCompound += r.compoundScore;

      if (r.sentimentLabel === 'Positive') posCount++;
      else if (r.sentimentLabel === 'Negative') negCount++;
      else if (r.sentimentLabel === 'Neutral') neuCount++;
      else if (r.sentimentLabel === 'Mixed') mixedCount++;

      if (topicCounts[r.topic] !== undefined) {
        topicCounts[r.topic]++;
      } else {
        topicCounts['Other']++;
      }
    }

    const avgSentiment = Number((totalCompound / totalCount).toFixed(4));
    const posShare = Number(((posCount / totalCount) * 100).toFixed(2));
    const negShare = Number(((negCount / totalCount) * 100).toFixed(2));
    const neuShare = Number(((neuCount / totalCount) * 100).toFixed(2));
    const mixedShare = Number(((mixedCount / totalCount) * 100).toFixed(2));
    const netSentimentScore = Number((posShare - negShare).toFixed(2));

    // Standard deviation of scores
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / (totalCount || 1);
    const stdDev = Math.sqrt(variance);

    // Confidence Interval 95%: z * stdDev / sqrt(N)
    // Widen for low data to reflect statistical uncertainty
    const marginOfError = isLowData 
      ? Math.max(0.4, Number((1.96 * (stdDev || 0.5) / Math.sqrt(Math.max(1, totalCount))).toFixed(4)) * 1.5)
      : Number((1.96 * stdDev / Math.sqrt(totalCount)).toFixed(4));

    const lowerBound = Number(Math.max(-1, avgSentiment - marginOfError).toFixed(4));
    const upperBound = Number(Math.min(1, avgSentiment + marginOfError).toFixed(4));

    // Topic Shares
    const topicShares: Record<FeedbackTopic, number> = createEmptyTopicCounts();
    for (const topic of FEEDBACK_TOPICS) {
      topicShares[topic] = Number(((topicCounts[topic] / totalCount) * 100).toFixed(2));
    }

    // Polarization Index (Edge Case 2): share of Mixed + stdDev of sentiment
    const polarizationIndex = Number(((mixedShare / 100) + stdDev).toFixed(3));

    return {
      periodKey: info.key,
      periodLabel: info.label,
      startDate: info.startDate,
      endDate: info.endDate,
      totalCount,
      avgSentiment,
      netSentimentScore,
      sentimentCounts: {
        positive: posCount,
        neutral: neuCount,
        negative: negCount,
        mixed: mixedCount,
      },
      sentimentShares: {
        positive: posShare,
        neutral: neuShare,
        negative: negShare,
        mixed: mixedShare,
      },
      topicDistribution: topicCounts,
      topicShares,
      confidenceBand: {
        lower: lowerBound,
        upper: upperBound,
      },
      isLowData,
      polarizationIndex,
    };
  });
}
