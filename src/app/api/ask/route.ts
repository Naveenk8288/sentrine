import { NextRequest, NextResponse } from 'next/server';
import { selectCitedReviews, selectRelevantReviewsForQuery } from '@/lib/analysis/engine';
import { FeedbackReview, getErrorMessage } from '@/lib/analysis/types';
import { answerCustomerQuery } from '@/lib/api/gemini';
import { getOrCreateStore } from '@/lib/db/store';

interface AskRequestBody {
  query?: string;
  reviews?: FeedbackReview[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AskRequestBody;
    const query = typeof body.query === 'string' ? body.query.trim() : '';

    if (!query) {
      return NextResponse.json({ error: 'Query cannot be empty' }, { status: 400 });
    }

    const allReviews =
      Array.isArray(body.reviews) && body.reviews.length > 0
        ? body.reviews
        : getOrCreateStore();

    const relevantReviews = selectRelevantReviewsForQuery(query, allReviews);
    const response = await answerCustomerQuery(query, relevantReviews);
    const citedReviewObjects = selectCitedReviews(allReviews, response.citations);

    return NextResponse.json({
      success: true,
      query,
      answer: response.answer,
      citations: response.citations,
      citedReviews: citedReviewObjects,
      isOfflineFallback: response.isOfflineFallback,
    });
  } catch (err: unknown) {
    console.error('Error in /api/ask:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Failed to answer query') },
      { status: 500 }
    );
  }
}
