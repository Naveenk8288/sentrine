import { NextRequest, NextResponse } from 'next/server';
import { buildUploadSuccessPayload, parseAndAnalyzeCSV } from '@/lib/analysis/engine';
import { getErrorMessage } from '@/lib/analysis/types';
import { resetStoreToDemo, setStoreReviews } from '@/lib/db/store';

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
          error:
            'No valid feedback records found in CSV. Please verify required columns (date, review_text).',
          validationSummary,
        },
        { status: 422 }
      );
    }

    setStoreReviews(reviews);
    return NextResponse.json(buildUploadSuccessPayload(reviews, validationSummary));
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
