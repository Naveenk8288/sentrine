import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateStore, filterReviews, getComputedBuckets } from '@/lib/db/store';
import { computeTopicDeltas } from '@/lib/analysis/topicDelta';
import { extractDistinctiveTerms } from '@/lib/analysis/distinctiveTerms';
import { generateGroundedCause } from '@/lib/api/gemini';
import {
  FeedbackReview,
  getErrorMessage,
  GlobalFilters,
  InvestigationResult,
  SupportingReviewItem,
} from '@/lib/analysis/types';

function parseCSVFilter(param: string | null): string[] | undefined {
  if (!param) return undefined;
  const parts = param
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

async function buildInvestigationResponse(
  allReviews: FeedbackReview[],
  periodKey: string,
  filters: Partial<GlobalFilters>
) {
  const period = filters.period || 'weekly';
  const minVolumeThreshold = filters.minVolumeThreshold ?? 5;

  const filteredReviews = filterReviews(allReviews, filters);
  const { buckets, reviewsByPeriod } = getComputedBuckets(
    filteredReviews,
    period,
    minVolumeThreshold
  );

  const targetBucketIndex = buckets.findIndex((b) => b.periodKey === periodKey);
  if (targetBucketIndex === -1) {
    return {
      status: 404 as const,
      payload: { error: `Period ${periodKey} not found in current dataset` },
    };
  }

  const targetBucket = buckets[targetBucketIndex];
  const targetReviews = reviewsByPeriod.get(periodKey) || [];

  const baselineBuckets = buckets
    .slice(Math.max(0, targetBucketIndex - 4), targetBucketIndex)
    .filter((b) => !b.isLowData);

  const baselinePeriods = baselineBuckets.map((b) => b.periodKey);
  const baselineReviews: FeedbackReview[] = [];
  for (const b of baselineBuckets) {
    const revs = reviewsByPeriod.get(b.periodKey) || [];
    baselineReviews.push(...revs);
  }

  const topicDeltas = computeTopicDeltas(targetReviews, baselineReviews);
  const distinctiveTerms = extractDistinctiveTerms(targetReviews, baselineReviews, 10);
  const topKeywords = distinctiveTerms.map((t) => t.term.toLowerCase());

  const scoredReviews: SupportingReviewItem[] = targetReviews.map((r) => {
    const textLower = r.reviewText.toLowerCase();
    const matched = topKeywords.filter((kw) => textLower.includes(kw));

    let score = 0;
    if (r.sentimentLabel === 'Negative') score += 50;
    else if (r.sentimentLabel === 'Mixed') score += 30;
    score += matched.length * 15;
    if (r.rating === 1) score += 20;

    return {
      review: r,
      matchedKeywords: matched,
      relevanceScore: score,
    };
  });

  const supportingReviews = scoredReviews
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);

  const aiExplanation = await generateGroundedCause(
    targetReviews,
    topicDeltas,
    distinctiveTerms
  );

  const result: InvestigationResult = {
    targetPeriodKey: targetBucket.periodKey,
    targetPeriodLabel: targetBucket.periodLabel,
    baselinePeriods,
    totalReviewsInPeriod: targetReviews.length,
    topicDeltas,
    distinctiveTerms,
    supportingReviews,
    aiExplanation,
    anomaly: targetBucket.anomaly,
  };

  return {
    status: 200 as const,
    payload: { success: true, data: result },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const periodKey = searchParams.get('periodKey');
    const period = (searchParams.get('period') as 'daily' | 'weekly' | 'monthly') || 'weekly';
    const minVol = parseInt(searchParams.get('minVolumeThreshold') || '5', 10);

    if (!periodKey) {
      return NextResponse.json(
        { error: 'Missing required query parameter: periodKey' },
        { status: 400 }
      );
    }

    const filters: Partial<GlobalFilters> = {
      categories: parseCSVFilter(searchParams.get('categories')),
      products: parseCSVFilter(searchParams.get('products')),
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      period,
      minVolumeThreshold: Number.isNaN(minVol) ? 5 : Math.max(1, minVol),
    };

    const allReviews = getOrCreateStore();
    const { status, payload } = await buildInvestigationResponse(allReviews, periodKey, filters);
    return NextResponse.json(payload, { status });
  } catch (err: unknown) {
    console.error('Error in /api/investigate:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Investigation calculation failed') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      periodKey?: string;
      reviews?: FeedbackReview[];
      filters?: Partial<GlobalFilters>;
    };

    if (!body.periodKey) {
      return NextResponse.json(
        { error: 'Missing required parameter: periodKey' },
        { status: 400 }
      );
    }

    const allReviews =
      Array.isArray(body.reviews) && body.reviews.length > 0 ? body.reviews : getOrCreateStore();
    const { status, payload } = await buildInvestigationResponse(
      allReviews,
      body.periodKey,
      body.filters || {}
    );
    return NextResponse.json(payload, { status });
  } catch (err: unknown) {
    console.error('Error in POST /api/investigate:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Investigation calculation failed') },
      { status: 500 }
    );
  }
}
