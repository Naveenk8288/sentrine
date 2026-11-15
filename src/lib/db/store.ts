import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { FeedbackReview, GlobalFilters, TimeBucket } from '../analysis/types';
import { scoreSentiment } from '../analysis/sentiment';
import { extractTopic } from '../analysis/topicClassifier';
import { aggregateByPeriod } from '../analysis/timeAggregator';
import { detectChanges } from '../analysis/anomalyDetector';

function normalizeCSVDate(rawDate: string | undefined): string {
  if (!rawDate) return '';
  const trimmed = rawDate.trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(d.getTime()) && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Global in-memory cache
let inMemoryReviews: FeedbackReview[] | null = null;

/**
 * Normalizes headers case-insensitively and returns structured reviews.
 */
export function parseAndAnalyzeCSV(csvContent: string): {
  reviews: FeedbackReview[];
  validationSummary: {
    totalRows: number;
    validRows: number;
    droppedRows: number;
    invalidDates: number;
    emptyTexts: number;
  };
} {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, '_'),
  });

  let droppedRows = 0;
  let invalidDates = 0;
  let emptyTexts = 0;
  const reviews: FeedbackReview[] = [];

  const rows = parsed.data || [];
  let rowIdx = 1;

  for (const row of rows) {
    // Find text column
    const text =
      row['review_text'] ||
      row['text'] ||
      row['review'] ||
      row['feedback'] ||
      row['comment'] ||
      row['content'];

    if (!text || text.trim() === '') {
      emptyTexts++;
      droppedRows++;
      continue;
    }

    // Find date column
    const rawDate = row['date'] || row['created_at'] || row['timestamp'] || row['time'];
    const formattedDate = normalizeCSVDate(rawDate);

    if (!formattedDate) {
      invalidDates++;
      droppedRows++;
      continue;
    }

    // Product and category
    const product = row['product'] || row['product_name'] || row['item'] || 'General Product';
    const category = row['category'] || row['department'] || 'General';
    const ratingRaw = row['rating'] || row['score'] || row['stars'];
    const rating = ratingRaw ? Number(ratingRaw) : undefined;
    const id = row['id'] || `REV-${String(rowIdx).padStart(5, '0')}`;

    // Compute sentiment and topic
    const sentimentRes = scoreSentiment(text);
    const topicRes = extractTopic(text);

    reviews.push({
      id,
      date: formattedDate,
      product: product.trim(),
      category: category.trim(),
      rating: !isNaN(rating as number) ? rating : undefined,
      reviewText: text.trim(),
      sentimentLabel: sentimentRes.sentimentLabel,
      compoundScore: sentimentRes.compoundScore,
      clauseScores: sentimentRes.clauseScores,
      topic: topicRes.topic,
      topicConfidence: topicRes.confidence,
    });

    rowIdx++;
  }

  return {
    reviews,
    validationSummary: {
      totalRows: rows.length,
      validRows: reviews.length,
      droppedRows,
      invalidDates,
      emptyTexts,
    },
  };
}

/**
 * Initializes store with default demo dataset from public/demo_feedback.csv.
 */
export function getOrCreateStore(): FeedbackReview[] {
  if (inMemoryReviews && inMemoryReviews.length > 0) {
    return inMemoryReviews;
  }

  const csvPath = path.join(process.cwd(), 'public', 'demo_feedback.csv');
  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const { reviews } = parseAndAnalyzeCSV(content);
    inMemoryReviews = reviews;
    return inMemoryReviews;
  }

  inMemoryReviews = [];
  return inMemoryReviews;
}

export function setStoreReviews(reviews: FeedbackReview[]): void {
  inMemoryReviews = reviews;
}

export function resetStoreToDemo(): FeedbackReview[] {
  const csvPath = path.join(process.cwd(), 'public', 'demo_feedback.csv');
  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const { reviews } = parseAndAnalyzeCSV(content);
    inMemoryReviews = reviews;
    return inMemoryReviews;
  }
  return [];
}

/**
 * Filters reviews based on global dashboard filters.
 */
export function filterReviews(
  reviews: FeedbackReview[],
  filters?: Partial<GlobalFilters>
): FeedbackReview[] {
  if (!filters) return reviews;

  return reviews.filter((r) => {
    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(r.category)) return false;
    }

    // Product filter
    if (filters.products && filters.products.length > 0) {
      if (!filters.products.includes(r.product)) return false;
    }

    // Date range
    if (filters.startDate && r.date < filters.startDate) return false;
    if (filters.endDate && r.date > filters.endDate) return false;

    return true;
  });
}

/**
 * Computes fully enriched time buckets with anomaly detection applied.
 */
export function getComputedBuckets(
  reviews: FeedbackReview[],
  mode: 'daily' | 'weekly' | 'monthly' = 'weekly',
  minVolumeThreshold: number = 5
): {
  buckets: TimeBucket[];
  reviewsByPeriod: Map<string, FeedbackReview[]>;
} {
  const buckets = aggregateByPeriod(reviews, mode, minVolumeThreshold);

  // Index reviews by bucket periodKey
  const reviewsByPeriod = new Map<string, FeedbackReview[]>();
  for (const b of buckets) {
    const periodReviews = reviews.filter((r) => r.date >= b.startDate && r.date <= b.endDate);
    reviewsByPeriod.set(b.periodKey, periodReviews);
  }

  // Detect changes and tag anomalies
  const detectedBuckets = detectChanges(buckets, reviewsByPeriod, {
    minVolumeThreshold,
    minNegativeReviewsForSustained: 3,
    scoreDropThreshold: 0.25,
    negativeShareSurgeThreshold: 20,
  });

  return {
    buckets: detectedBuckets,
    reviewsByPeriod,
  };
}
