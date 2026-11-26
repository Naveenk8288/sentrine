import fs from 'fs';
import path from 'path';
import {
  filterReviews,
  getComputedBuckets,
  parseAndAnalyzeCSV,
} from '../analysis/engine';
import { FeedbackReview } from '../analysis/types';

export { filterReviews, getComputedBuckets, parseAndAnalyzeCSV };

// Global in-memory cache
let inMemoryReviews: FeedbackReview[] | null = null;

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
