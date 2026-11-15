import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateStore, filterReviews, getComputedBuckets } from '@/lib/db/store';
import {
  DashboardKPISummary,
  FeedbackReview,
  getErrorMessage,
  GlobalFilters,
  GlobalFiltersSchema,
} from '@/lib/analysis/types';

function parseCSVFilter(param: string | null): string[] | undefined {
  if (!param) return undefined;
  const parts = param
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function buildTrendsResponse(
  allReviews: FeedbackReview[],
  rawFilters: Partial<GlobalFilters>
) {
  const parsedFilters = GlobalFiltersSchema.partial().safeParse(rawFilters);
  const filters: Partial<GlobalFilters> = parsedFilters.success ? parsedFilters.data : {};
  const period = filters.period || 'weekly';
  const minVolumeThreshold = filters.minVolumeThreshold ?? 5;

  const filteredReviews = filterReviews(allReviews, filters);
  const { buckets } = getComputedBuckets(filteredReviews, period, minVolumeThreshold);

  // Overall KPIs
  const totalReviews = filteredReviews.length;
  let totalScore = 0;
  let posCount = 0;
  let negCount = 0;

  for (const r of filteredReviews) {
    totalScore += r.compoundScore;
    if (r.sentimentLabel === 'Positive') posCount++;
    if (r.sentimentLabel === 'Negative') negCount++;
  }

  const avgSentiment = totalReviews > 0 ? Number((totalScore / totalReviews).toFixed(4)) : 0;
  const posShare = totalReviews > 0 ? Number(((posCount / totalReviews) * 100).toFixed(1)) : 0;
  const negShare = totalReviews > 0 ? Number(((negCount / totalReviews) * 100).toFixed(1)) : 0;
  const netSentimentScore = Number((posShare - negShare).toFixed(1));

  let sentimentTrendDelta = 0;
  if (buckets.length >= 2) {
    const latest = buckets[buckets.length - 1];
    const previous = buckets[buckets.length - 2];
    sentimentTrendDelta = Number((latest.avgSentiment - previous.avgSentiment).toFixed(3));
  }

  const anomalies = buckets
    .filter((b) => b.anomaly !== undefined)
    .map((b) => b.anomaly!);

  const activeAnomalyCount = anomalies.filter((a) => a.type === 'SUSTAINED_DECLINE').length;
  const isolatedEventCount = anomalies.filter((a) => a.type === 'ISOLATED_EVENT').length;

  const kpis: DashboardKPISummary = {
    totalReviews,
    avgSentiment,
    positiveShare: posShare,
    negativeShare: negShare,
    netSentimentScore,
    sentimentTrendDelta,
    activeAnomalyCount,
    isolatedEventCount,
  };

  const allCategories = Array.from(new Set(allReviews.map((r) => r.category))).sort();
  const filteredCategorySet =
    filters.categories && filters.categories.length > 0 ? new Set(filters.categories) : null;

  const availableProducts = Array.from(
    new Set(
      allReviews
        .filter((r) => !filteredCategorySet || filteredCategorySet.has(r.category))
        .map((r) => r.product)
    )
  ).sort();

  const minDate = allReviews.reduce((min, r) => (r.date < min ? r.date : min), allReviews[0]?.date || '');
  const maxDate = allReviews.reduce((max, r) => (r.date > max ? r.date : max), allReviews[0]?.date || '');

  return {
    success: true,
    kpis,
    buckets,
    anomalies,
    filters: {
      categories: allCategories,
      products: availableProducts,
      minDate,
      maxDate,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const minVol = parseInt(searchParams.get('minVolumeThreshold') || '5', 10);

    const rawFilters: Partial<GlobalFilters> = {
      categories: parseCSVFilter(searchParams.get('categories')),
      products: parseCSVFilter(searchParams.get('products')),
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      period: (searchParams.get('period') as 'daily' | 'weekly' | 'monthly') || 'weekly',
      minVolumeThreshold: Number.isNaN(minVol) ? 5 : Math.max(1, minVol),
    };

    const allReviews = getOrCreateStore();
    return NextResponse.json(buildTrendsResponse(allReviews, rawFilters));
  } catch (err: unknown) {
    console.error('Error in /api/trends:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Failed to compute sentiment trends') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      reviews?: FeedbackReview[];
      filters?: Partial<GlobalFilters>;
    };
    const allReviews =
      Array.isArray(body.reviews) && body.reviews.length > 0 ? body.reviews : getOrCreateStore();
    return NextResponse.json(buildTrendsResponse(allReviews, body.filters || {}));
  } catch (err: unknown) {
    console.error('Error in POST /api/trends:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Failed to compute sentiment trends') },
      { status: 500 }
    );
  }
}
