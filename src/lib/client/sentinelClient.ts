import type {
  AskApiResponse,
  GranularityMode,
  InvestigateApiResponse,
  TrendsApiResponse,
  UploadApiResponse,
} from '@/components/types';
import {
  assembleInvestigationResult,
  buildOfflineQueryResponse,
  buildTrendsResponse,
  buildUploadSuccessPayload,
  generateExtractiveFallback,
  parseAndAnalyzeCSV,
  prepareInvestigationContext,
  selectCitedReviews,
  selectRelevantReviewsForQuery,
} from '@/lib/analysis/engine';
import type { FeedbackReview, GlobalFilters } from '@/lib/analysis/types';

const IS_STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

let cachedDemoPromise: Promise<FeedbackReview[]> | null = null;

/**
 * Loads and parses the bundled demo_feedback.csv directly in the browser for static hosting.
 */
async function loadDemoReviewsInBrowser(): Promise<FeedbackReview[]> {
  if (!cachedDemoPromise) {
    cachedDemoPromise = fetch(`${BASE_PATH}/demo_feedback.csv`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch demo_feedback.csv (${res.status})`);
        }
        const csvText = await res.text();
        const { reviews } = parseAndAnalyzeCSV(csvText);
        return reviews;
      })
      .catch((err) => {
        cachedDemoPromise = null;
        throw err;
      });
  }
  return cachedDemoPromise;
}

async function resolveDataset(customReviews: FeedbackReview[] | null): Promise<FeedbackReview[]> {
  if (customReviews && customReviews.length > 0) {
    return customReviews;
  }
  return loadDemoReviewsInBrowser();
}

async function parseJsonOrFallback(res: Response): Promise<{ ok: boolean; json: unknown | null }> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { ok: false, json: null };
  }
  try {
    const json = await res.json();
    return { ok: true, json };
  } catch {
    return { ok: false, json: null };
  }
}

export async function fetchTrendsData(params: {
  customReviews: FeedbackReview[] | null;
  period: GranularityMode;
  categories: string[];
  products: string[];
  startDate: string;
  endDate: string;
  minVolumeThreshold: number;
}): Promise<TrendsApiResponse> {
  const filters: Partial<GlobalFilters> = {
    period: params.period,
    categories: params.categories.length ? params.categories : undefined,
    products: params.products.length ? params.products : undefined,
    startDate: params.startDate || undefined,
    endDate: params.endDate || undefined,
    minVolumeThreshold: params.minVolumeThreshold,
  };

  if (!IS_STATIC_EXPORT) {
    try {
      let res: Response;
      if (params.customReviews) {
        res = await fetch('/api/trends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviews: params.customReviews, filters }),
        });
      } else {
        const search = new URLSearchParams();
        search.set('period', params.period);
        search.set('minVolumeThreshold', String(params.minVolumeThreshold));
        if (params.categories.length > 0) search.set('categories', params.categories.join(','));
        if (params.products.length > 0) search.set('products', params.products.join(','));
        if (params.startDate) search.set('startDate', params.startDate);
        if (params.endDate) search.set('endDate', params.endDate);
        res = await fetch(`/api/trends?${search.toString()}`);
      }

      const parsed = await parseJsonOrFallback(res);
      if (parsed.ok) {
        const json = parsed.json as TrendsApiResponse;
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load sentiment trends');
        }
        return json;
      }
    } catch (err) {
      if (err instanceof TypeError === false && !(err instanceof SyntaxError)) {
        throw err;
      }
    }
  }

  const allReviews = await resolveDataset(params.customReviews);
  return buildTrendsResponse(allReviews, filters);
}

export async function fetchInvestigationData(params: {
  periodKey: string;
  customReviews: FeedbackReview[] | null;
  period: GranularityMode;
  categories: string[];
  products: string[];
  startDate: string;
  endDate: string;
  minVolumeThreshold: number;
}): Promise<InvestigateApiResponse> {
  const filters: Partial<GlobalFilters> = {
    period: params.period,
    categories: params.categories.length ? params.categories : undefined,
    products: params.products.length ? params.products : undefined,
    startDate: params.startDate || undefined,
    endDate: params.endDate || undefined,
    minVolumeThreshold: params.minVolumeThreshold,
  };

  if (!IS_STATIC_EXPORT) {
    try {
      let res: Response;
      if (params.customReviews) {
        res = await fetch('/api/investigate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            periodKey: params.periodKey,
            reviews: params.customReviews,
            filters,
          }),
        });
      } else {
        const search = new URLSearchParams();
        search.set('periodKey', params.periodKey);
        search.set('period', params.period);
        search.set('minVolumeThreshold', String(params.minVolumeThreshold));
        if (params.categories.length > 0) search.set('categories', params.categories.join(','));
        if (params.products.length > 0) search.set('products', params.products.join(','));
        if (params.startDate) search.set('startDate', params.startDate);
        if (params.endDate) search.set('endDate', params.endDate);
        res = await fetch(`/api/investigate?${search.toString()}`);
      }

      const parsed = await parseJsonOrFallback(res);
      if (parsed.ok) {
        const json = parsed.json as InvestigateApiResponse;
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || 'Failed to investigate period');
        }
        return json;
      }
    } catch (err) {
      if (err instanceof TypeError === false && !(err instanceof SyntaxError)) {
        throw err;
      }
    }
  }

  const allReviews = await resolveDataset(params.customReviews);
  const ctx = prepareInvestigationContext(allReviews, params.periodKey, filters);
  if (!ctx) {
    throw new Error(`Period ${params.periodKey} not found in current dataset`);
  }
  const aiExplanation = generateExtractiveFallback(
    ctx.targetReviews,
    ctx.topicDeltas,
    ctx.distinctiveTerms
  );
  return {
    success: true,
    data: assembleInvestigationResult(ctx, aiExplanation),
  };
}

export async function askSentinelQuestion(
  query: string,
  customReviews: FeedbackReview[] | null
): Promise<AskApiResponse> {
  if (!IS_STATIC_EXPORT) {
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          ...(customReviews ? { reviews: customReviews } : {}),
        }),
      });
      const parsed = await parseJsonOrFallback(res);
      if (parsed.ok) {
        const json = parsed.json as AskApiResponse;
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to answer question');
        }
        return json;
      }
    } catch (err) {
      if (err instanceof TypeError === false && !(err instanceof SyntaxError)) {
        throw err;
      }
    }
  }

  const allReviews = await resolveDataset(customReviews);
  const relevantReviews = selectRelevantReviewsForQuery(query, allReviews);
  const response = buildOfflineQueryResponse(query, relevantReviews);
  const citedReviews = selectCitedReviews(allReviews, response.citations);

  return {
    success: true,
    query,
    answer: response.answer,
    citations: response.citations,
    citedReviews,
    isOfflineFallback: response.isOfflineFallback,
  };
}

export async function processCsvUpload(input: {
  file?: File | null;
  csvText?: string;
}): Promise<UploadApiResponse> {
  if (!IS_STATIC_EXPORT) {
    try {
      let res: Response;
      if (input.file) {
        const formData = new FormData();
        formData.append('file', input.file);
        res = await fetch('/api/upload', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvText: input.csvText || '' }),
        });
      }

      const parsed = await parseJsonOrFallback(res);
      if (parsed.ok) {
        const json = parsed.json as UploadApiResponse;
        if (!res.ok || !json.success || !json.reviews) {
          throw new Error(json.error || 'CSV processing failed');
        }
        return json;
      }
    } catch (err) {
      if (err instanceof TypeError === false && !(err instanceof SyntaxError)) {
        throw err;
      }
    }
  }

  const rawText = input.file ? await input.file.text() : input.csvText || '';
  if (!rawText.trim()) {
    throw new Error('CSV content is empty');
  }

  const { reviews, validationSummary } = parseAndAnalyzeCSV(rawText);
  if (reviews.length === 0) {
    throw new Error(
      'No valid feedback records found in CSV. Please verify required columns (date, review_text).'
    );
  }

  return buildUploadSuccessPayload(reviews, validationSummary);
}

export async function resetDatasetOnServer(): Promise<void> {
  if (IS_STATIC_EXPORT) return;
  try {
    await fetch('/api/upload', { method: 'DELETE' });
  } catch {
    // Safe to proceed with client reset
  }
}

export async function dispatchAlertNotification(payload: {
  periodLabel: string;
  anomalyType: string;
  severity: string;
  scoreDrop: number;
  negativeShareSurge: number;
  topTopicDelta: string;
  sampleEvidenceText: string;
  webhookUrl?: string;
  isTest: boolean;
}): Promise<{ success: boolean; message: string }> {
  if (!IS_STATIC_EXPORT) {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const parsed = await parseJsonOrFallback(res);
      if (parsed.ok) {
        return parsed.json as { success: boolean; message: string };
      }
    } catch {
      // Fall through to static simulation message
    }
  }

  if (!payload.webhookUrl) {
    return {
      success: true,
      message: `Demo Simulation: ${payload.severity} alert prepared for ${payload.periodLabel} (${payload.topTopicDelta}).`,
    };
  }

  return {
    success: true,
    message:
      'Static hosting note: Browsers block cross-origin webhook POSTs from static sites. Use the Vercel deployment to deliver live Slack/Discord webhooks.',
  };
}
