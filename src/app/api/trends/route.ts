import { NextRequest, NextResponse } from 'next/server';
import { buildTrendsResponse, parseCSVFilter } from '@/lib/analysis/engine';
import { FeedbackReview, getErrorMessage, GlobalFilters } from '@/lib/analysis/types';
import { getOrCreateStore } from '@/lib/db/store';

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
