import { z } from 'zod';

export type SentimentLabel = 'Positive' | 'Neutral' | 'Negative' | 'Mixed';

export const FEEDBACK_TOPICS = [
  'Delivery',
  'Product Quality',
  'Battery & Power',
  'Software/Updates',
  'Customer Support',
  'Pricing',
  'Performance',
  'Other',
] as const;

export type FeedbackTopic = typeof FEEDBACK_TOPICS[number];

/** Returns a zero-initialized count map across all canonical feedback topics. */
export function createEmptyTopicCounts(): Record<FeedbackTopic, number> {
  return {
    Delivery: 0,
    'Product Quality': 0,
    'Battery & Power': 0,
    'Software/Updates': 0,
    'Customer Support': 0,
    Pricing: 0,
    Performance: 0,
    Other: 0,
  };
}

/** Extracts a safe human-readable error message from an unknown thrown value. */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export interface ClauseScore {
  clause: string;
  score: number;
}

export interface FeedbackReview {
  id: string;
  date: string; // YYYY-MM-DD
  product: string;
  category: string;
  rating?: number; // 1-5
  reviewText: string;
  sentimentLabel: SentimentLabel;
  compoundScore: number; // -1 to 1
  clauseScores?: ClauseScore[];
  topic: FeedbackTopic;
  topicConfidence?: number;
}

export type AnomalyType = 'SUSTAINED_DECLINE' | 'ISOLATED_EVENT' | 'VOLATILITY_SPIKE';
export type AnomalySeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AnomalyRecord {
  id: string;
  periodKey: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  scoreDrop: number; // positive drop magnitude e.g. 0.42
  negativeShareIncreasePts: number; // e.g. 28.5 percentage points
  drivingReviewId?: string;
  drivingReviewText?: string;
  summary: string;
  baselinePeriodKey: string;
}

export interface TimeBucket {
  periodKey: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalCount: number;
  avgSentiment: number; // -1.0 to 1.0
  netSentimentScore: number; // (% Positive - % Negative) * 100
  sentimentCounts: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  sentimentShares: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  topicDistribution: Record<FeedbackTopic, number>;
  topicShares: Record<FeedbackTopic, number>;
  confidenceBand: {
    lower: number;
    upper: number;
  };
  isLowData: boolean; // True if totalCount < MIN_REVIEWS_THRESHOLD (default 5)
  polarizationIndex: number; // mixed share + stdDev of sentiment
  anomaly?: AnomalyRecord;
}

export interface TopicDelta {
  topic: FeedbackTopic;
  baselineShare: number; // 0 to 100
  currentShare: number; // 0 to 100
  deltaPercentagePoints: number; // currentShare - baselineShare
  isSurge: boolean;
}

export interface DistinctiveTerm {
  term: string;
  targetCount: number;
  baselineCount: number;
  targetFrequency: number;
  baselineFrequency: number;
  score: number; // significance score
}

export interface SupportingReviewItem {
  review: FeedbackReview;
  matchedKeywords: string[];
  relevanceScore: number;
}

export interface AIExplanationResult {
  likelyCause: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  citations: string[]; // Review IDs grounded in evidence
  eventDetectiveHypothesis?: string;
  isOfflineFallback: boolean;
}

export interface InvestigationResult {
  targetPeriodKey: string;
  targetPeriodLabel: string;
  baselinePeriods: string[];
  totalReviewsInPeriod: number;
  topicDeltas: TopicDelta[];
  distinctiveTerms: DistinctiveTerm[];
  supportingReviews: SupportingReviewItem[];
  aiExplanation: AIExplanationResult;
  anomaly?: AnomalyRecord;
}

export interface DashboardKPISummary {
  totalReviews: number;
  avgSentiment: number;
  positiveShare: number;
  negativeShare: number;
  netSentimentScore: number;
  sentimentTrendDelta: number; // PoP change in avg sentiment
  activeAnomalyCount: number;
  isolatedEventCount: number;
}

// Zod schemas for API validation
export const GlobalFiltersSchema = z.object({
  categories: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  minVolumeThreshold: z.number().int().min(1).default(5),
});

export type GlobalFilters = z.infer<typeof GlobalFiltersSchema>;
