import type {
  AnomalyRecord,
  DashboardKPISummary,
  FeedbackReview,
  InvestigationResult,
  TimeBucket,
} from '@/lib/analysis/types';

export type GranularityMode = 'daily' | 'weekly' | 'monthly';

export interface TrendsMetadataFilters {
  categories: string[];
  products: string[];
  minDate: string;
  maxDate: string;
}

export interface TrendsApiResponse {
  success: boolean;
  kpis: DashboardKPISummary;
  buckets: TimeBucket[];
  anomalies: AnomalyRecord[];
  filters: TrendsMetadataFilters;
  error?: string;
}

export interface InvestigateApiResponse {
  success: boolean;
  data?: InvestigationResult;
  error?: string;
}

export interface AskApiResponse {
  success: boolean;
  query: string;
  answer: string;
  citations: string[];
  citedReviews: FeedbackReview[];
  isOfflineFallback: boolean;
  error?: string;
}

export interface UploadValidationSummary {
  totalRows: number;
  validRows: number;
  droppedRows: number;
  invalidDates: number;
  emptyTexts: number;
}

export interface UploadApiResponse {
  success: boolean;
  message: string;
  validationSummary: UploadValidationSummary;
  preview: FeedbackReview[];
  reviews?: FeedbackReview[];
  metadata?: {
    totalReviews: number;
    categories: string[];
    products: string[];
    dateMin: string;
    dateMax: string;
  };
  error?: string;
}

