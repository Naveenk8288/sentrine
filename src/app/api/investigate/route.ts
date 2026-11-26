import { NextRequest, NextResponse } from 'next/server';
import {
  assembleInvestigationResult,
  parseCSVFilter,
  prepareInvestigationContext,
} from '@/lib/analysis/engine';
import { FeedbackReview, getErrorMessage, GlobalFilters } from '@/lib/analysis/types';
import { generateGroundedCause } from '@/lib/api/gemini';
import { getOrCreateStore } from '@/lib/db/store';

async function buildInvestigationResponse(
  allReviews: FeedbackReview[],
  periodKey: string,
  filters: Partial<GlobalFilters>
) {
  const ctx = prepareInvestigationContext(allReviews, periodKey, filters);
  if (!ctx) {
    return {
      status: 404 as const,
      payload: { error: `Period ${periodKey} not found in current dataset` },
    };
  }

  const aiExplanation = await generateGroundedCause(
    ctx.targetReviews,
    ctx.topicDeltas,
    ctx.distinctiveTerms
  );

  return {
    status: 200 as const,
    payload: { success: true, data: assembleInvestigationResult(ctx, aiExplanation) },
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
