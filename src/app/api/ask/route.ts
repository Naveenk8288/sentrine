import { NextRequest, NextResponse } from 'next/server';
import { FeedbackReview, getErrorMessage } from '@/lib/analysis/types';
import { getOrCreateStore } from '@/lib/db/store';
import { answerCustomerQuery } from '@/lib/api/gemini';

interface AskRequestBody {
  query?: string;
  reviews?: FeedbackReview[];
}

const STOP_WORDS = new Set([
  'what', 'when', 'where', 'which', 'about', 'there', 'their', 'these', 'those',
  'with', 'from', 'have', 'been', 'were', 'happened', 'sentiment', 'reviews',
  'review', 'customers', 'customer', 'feedback', 'this', 'that', 'week',
]);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AskRequestBody;
    const query = typeof body.query === 'string' ? body.query.trim() : '';

    if (!query) {
      return NextResponse.json({ error: 'Query cannot be empty' }, { status: 400 });
    }

    const allReviews = Array.isArray(body.reviews) && body.reviews.length > 0
      ? body.reviews
      : getOrCreateStore();

    const lowerQuery = query.toLowerCase();
    const queryTokens = lowerQuery
      .replace(/[^a-z0-9\s.-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    const asksAboutProblems =
      /\b(drop|dropped|decline|declined|issue|issues|problem|problems|bug|complaint|complaints|negative|wrong|fail|crash|why|worse|spike|surge|bad|poor|mixed|polarized)\b/i.test(
        lowerQuery
      );

    // Score each review for relevance rather than slicing chronologically
    const scored = allReviews.map((r) => {
      let score = 0;
      const prodLower = r.product.toLowerCase();
      const catLower = r.category.toLowerCase();
      const topicLower = r.topic.toLowerCase();
      const textLower = r.reviewText.toLowerCase();

      if (lowerQuery.includes(prodLower)) score += 35;
      if (lowerQuery.includes(catLower)) score += 20;
      if (lowerQuery.includes(topicLower)) score += 20;

      for (const token of queryTokens) {
        if (textLower.includes(token)) score += 15;
        if (prodLower.includes(token)) score += 10;
        if (topicLower.includes(token)) score += 10;
      }

      if (score > 0 || queryTokens.length === 0) {
        if (asksAboutProblems) {
          if (r.sentimentLabel === 'Negative') score += 30;
          else if (r.sentimentLabel === 'Mixed') score += 20;
          if (r.rating !== undefined && r.rating <= 2) score += 10;
        }
        if (lowerQuery.includes('mixed') && r.sentimentLabel === 'Mixed') {
          score += 40;
        }
      }

      return { review: r, score };
    });

    let relevantReviews = scored
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.review.compoundScore - b.review.compoundScore;
      })
      .map((item) => item.review);

    if (relevantReviews.length === 0) {
      relevantReviews = allReviews
        .filter((r) => r.sentimentLabel === 'Negative' || r.sentimentLabel === 'Mixed')
        .sort((a, b) => a.compoundScore - b.compoundScore);
    }

    if (relevantReviews.length === 0) {
      relevantReviews = allReviews;
    }

    const response = await answerCustomerQuery(query, relevantReviews);

    // Retrieve full review objects for citations so user can click to inspect them
    const citationSet = new Set(response.citations);
    const citedReviewObjects = allReviews.filter((r) => citationSet.has(r.id)).slice(0, 5);

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
