import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/analysis/types';
import { parseAndAnalyzeCSV, resetStoreToDemo, setStoreReviews } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let csvText = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }
      csvText = await file.text();
    } else {
      const body = (await req.json()) as { csvText?: string };
      csvText = typeof body.csvText === 'string' ? body.csvText : '';
    }

    if (!csvText || csvText.trim() === '') {
      return NextResponse.json({ error: 'CSV content is empty' }, { status: 400 });
    }

    const { reviews, validationSummary } = parseAndAnalyzeCSV(csvText);

    if (reviews.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid feedback records found in CSV. Please verify required columns (date, review_text).',
          validationSummary,
        },
        { status: 422 }
      );
    }

    // Update in-memory store
    setStoreReviews(reviews);

    // Extract unique categories and products
    const categories = Array.from(new Set(reviews.map((r) => r.category))).sort();
    const products = Array.from(new Set(reviews.map((r) => r.product))).sort();

    return NextResponse.json({
      success: true,
      message: `Successfully analyzed ${reviews.length} reviews`,
      validationSummary,
      preview: reviews.slice(0, 5),
      reviews,
      metadata: {
        totalReviews: reviews.length,
        categories,
        products,
        dateMin: reviews.reduce((min, r) => (r.date < min ? r.date : min), reviews[0].date),
        dateMax: reviews.reduce((max, r) => (r.date > max ? r.date : max), reviews[0].date),
      },
    });
  } catch (err: unknown) {
    console.error('Error in /api/upload:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Internal server error while processing CSV') },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const reviews = resetStoreToDemo();
    return NextResponse.json({
      success: true,
      message: `Reset dataset to demo reviews (${reviews.length} records)`,
    });
  } catch (err: unknown) {
    console.error('Error resetting dataset:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Failed to reset dataset') },
      { status: 500 }
    );
  }
}
