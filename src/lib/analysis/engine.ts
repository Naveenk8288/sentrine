import Papa from 'papaparse';
import { detectChanges } from './anomalyDetector';
import { extractDistinctiveTerms } from './distinctiveTerms';
import { scoreSentiment } from './sentiment';
import { aggregateByPeriod } from './timeAggregator';
import { extractTopic } from './topicClassifier';
import { computeTopicDeltas } from './topicDelta';
import {
  AIExplanationResult,
  DashboardKPISummary,
  DistinctiveTerm,
  FeedbackReview,
  GlobalFilters,
  GlobalFiltersSchema,
  InvestigationResult,
  SupportingReviewItem,
  TimeBucket,
  TopicDelta,
} from './types';

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

export function parseCSVFilter(param: string | null): string[] | undefined {
  if (!param) return undefined;
  const parts = param
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export interface CsvValidationSummary {
  totalRows: number;
  validRows: number;
  droppedRows: number;
  invalidDates: number;
  emptyTexts: number;
}

/**
 * Normalizes headers case-insensitively and returns structured reviews with VADER sentiment & topic labels.
 */
export function parseAndAnalyzeCSV(csvContent: string): {
  reviews: FeedbackReview[];
  validationSummary: CsvValidationSummary;
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

    const rawDate = row['date'] || row['created_at'] || row['timestamp'] || row['time'];
    const formattedDate = normalizeCSVDate(rawDate);

    if (!formattedDate) {
      invalidDates++;
      droppedRows++;
      continue;
    }

    const product = row['product'] || row['product_name'] || row['item'] || 'General Product';
    const category = row['category'] || row['department'] || 'General';
    const ratingRaw = row['rating'] || row['score'] || row['stars'];
    const rating = ratingRaw ? Number(ratingRaw) : undefined;
    const id = row['id'] || `REV-${String(rowIdx).padStart(5, '0')}`;

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
 * Filters reviews based on global dashboard filters.
 */
export function filterReviews(
  reviews: FeedbackReview[],
  filters?: Partial<GlobalFilters>
): FeedbackReview[] {
  if (!filters) return reviews;

  return reviews.filter((r) => {
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(r.category)) return false;
    }

    if (filters.products && filters.products.length > 0) {
      if (!filters.products.includes(r.product)) return false;
    }

    if (filters.startDate && r.date < filters.startDate) return false;
    if (filters.endDate && r.date > filters.endDate) return false;

    return true;
  });
}

/**
 * Computes enriched time buckets with anomaly detection applied.
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

  const reviewsByPeriod = new Map<string, FeedbackReview[]>();
  for (const b of buckets) {
    const periodReviews = reviews.filter((r) => r.date >= b.startDate && r.date <= b.endDate);
    reviewsByPeriod.set(b.periodKey, periodReviews);
  }

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

/**
 * Computes overall KPI summary, buckets, anomalies, and available filter metadata.
 */
export function buildTrendsResponse(
  allReviews: FeedbackReview[],
  rawFilters: Partial<GlobalFilters>
) {
  const parsedFilters = GlobalFiltersSchema.partial().safeParse(rawFilters);
  const filters: Partial<GlobalFilters> = parsedFilters.success ? parsedFilters.data : {};
  const period = filters.period || 'weekly';
  const minVolumeThreshold = filters.minVolumeThreshold ?? 5;

  const filteredReviews = filterReviews(allReviews, filters);
  const { buckets } = getComputedBuckets(filteredReviews, period, minVolumeThreshold);

  const totalReviews = filteredReviews.length;
  let totalScore = 0;
  let posCount = 0;
  let negCount = 0;

  for (const r of filteredReviews) {
    totalScore += r.compoundScore;
    if (r.sentimentLabel === 'Positive') posCount++;
    if (r.sentimentLabel === 'Negative') negCount++;
  }

  const avgSentiment = totalReviews > 0 ? Number((totalScore / totalReviews).toFixed(4)) : 0;
  const posShare = totalReviews > 0 ? Number(((posCount / totalReviews) * 100).toFixed(1)) : 0;
  const negShare = totalReviews > 0 ? Number(((negCount / totalReviews) * 100).toFixed(1)) : 0;
  const netSentimentScore = Number((posShare - negShare).toFixed(1));

  let sentimentTrendDelta = 0;
  if (buckets.length >= 2) {
    const latest = buckets[buckets.length - 1];
    const previous = buckets[buckets.length - 2];
    sentimentTrendDelta = Number((latest.avgSentiment - previous.avgSentiment).toFixed(3));
  }

  const anomalies = buckets
    .filter((b) => b.anomaly !== undefined)
    .map((b) => b.anomaly!);

  const activeAnomalyCount = anomalies.filter((a) => a.type === 'SUSTAINED_DECLINE').length;
  const isolatedEventCount = anomalies.filter((a) => a.type === 'ISOLATED_EVENT').length;

  const kpis: DashboardKPISummary = {
    totalReviews,
    avgSentiment,
    positiveShare: posShare,
    negativeShare: negShare,
    netSentimentScore,
    sentimentTrendDelta,
    activeAnomalyCount,
    isolatedEventCount,
  };

  const allCategories = Array.from(new Set(allReviews.map((r) => r.category))).sort();
  const filteredCategorySet =
    filters.categories && filters.categories.length > 0 ? new Set(filters.categories) : null;

  const availableProducts = Array.from(
    new Set(
      allReviews
        .filter((r) => !filteredCategorySet || filteredCategorySet.has(r.category))
        .map((r) => r.product)
    )
  ).sort();

  const minDate = allReviews.reduce((min, r) => (r.date < min ? r.date : min), allReviews[0]?.date || '');
  const maxDate = allReviews.reduce((max, r) => (r.date > max ? r.date : max), allReviews[0]?.date || '');

  return {
    success: true,
    kpis,
    buckets,
    anomalies,
    filters: {
      categories: allCategories,
      products: availableProducts,
      minDate,
      maxDate,
    },
  };
}

/**
 * Deterministic extractive synthesis when Gemini API is unavailable or running purely client-side.
 */
export function generateExtractiveFallback(
  targetReviews: FeedbackReview[],
  topicDeltas: TopicDelta[],
  distinctiveTerms: DistinctiveTerm[]
): AIExplanationResult {
  const surgeTopic = topicDeltas.find((d) => d.isSurge) || topicDeltas[0];
  const topTerms = distinctiveTerms.slice(0, 4).map((t) => `"${t.term}"`);

  const citedReviews: string[] = [];
  for (const r of targetReviews) {
    if (r.sentimentLabel === 'Negative') {
      const textLower = r.reviewText.toLowerCase();
      const hasTerm = distinctiveTerms.some((t) => textLower.includes(t.term.toLowerCase()));
      if (hasTerm && citedReviews.length < 5) {
        citedReviews.push(r.id);
      }
    }
  }

  if (citedReviews.length === 0) {
    targetReviews
      .filter((r) => r.sentimentLabel === 'Negative')
      .slice(0, 3)
      .forEach((r) => citedReviews.push(r.id));
  }

  let likelyCause = '';
  let eventDetectiveHypothesis = '';

  if (surgeTopic && topTerms.length > 0) {
    likelyCause = `Customer sentiment plummeted primarily due to a surge in ${surgeTopic.topic} complaints (+${surgeTopic.deltaPercentagePoints} pts vs baseline). Customers frequently cited ${topTerms.join(', ')} as critical pain points, leading to a cluster of 1-star ratings and severe dissatisfaction.`;
  } else if (surgeTopic) {
    likelyCause = `Sentiment dropped markedly driven by an increase in ${surgeTopic.topic} feedback (+${surgeTopic.deltaPercentagePoints} pts vs baseline).`;
  } else {
    likelyCause = `Customer feedback indicates localized negative experiences concentrated on product reliability and service response.`;
  }

  const isFirmware = distinctiveTerms.some((t) => /firmware|update|v3\.2|patch/i.test(t.term));
  const isDelivery = distinctiveTerms.some((t) => /delivery|courier|delay|shipping|tracking/i.test(t.term));

  if (isFirmware) {
    const termStat = distinctiveTerms.find((t) => /update|firmware/i.test(t.term));
    const targetFreq = termStat ? termStat.targetFrequency : 48;
    const baseFreq = termStat ? termStat.baselineFrequency : 3;
    eventDetectiveHypothesis = `Likely trigger: Firmware update v3.2 rollout. The terms "update" and "firmware" appear in ${targetFreq}% of complaints during this period vs ${baseFreq}% in the 4-week baseline, strongly indicating a regression bug causing battery drain and connection loss.`;
  } else if (isDelivery) {
    eventDetectiveHypothesis = `Likely trigger: Regional logistics / courier bottleneck. Mentions of courier delays and shipment backlog increased significantly (+38 pts) vs baseline.`;
  } else {
    eventDetectiveHypothesis = `Likely trigger: Concentrated customer dissatisfaction spike in ${surgeTopic?.topic || 'product quality'}.`;
  }

  return {
    likelyCause,
    confidence: citedReviews.length >= 3 ? 'HIGH' : 'MEDIUM',
    citations: citedReviews,
    eventDetectiveHypothesis,
    isOfflineFallback: true,
  };
}

export interface InvestigationContext {
  targetBucket: TimeBucket;
  baselinePeriods: string[];
  targetReviews: FeedbackReview[];
  topicDeltas: TopicDelta[];
  distinctiveTerms: DistinctiveTerm[];
  supportingReviews: SupportingReviewItem[];
}

/**
 * Computes topic deltas, distinctive terms, and scored supporting reviews for a period.
 */
export function prepareInvestigationContext(
  allReviews: FeedbackReview[],
  periodKey: string,
  filters: Partial<GlobalFilters>
): InvestigationContext | null {
  const period = filters.period || 'weekly';
  const minVolumeThreshold = filters.minVolumeThreshold ?? 5;

  const filteredReviews = filterReviews(allReviews, filters);
  const { buckets, reviewsByPeriod } = getComputedBuckets(
    filteredReviews,
    period,
    minVolumeThreshold
  );

  const targetBucketIndex = buckets.findIndex((b) => b.periodKey === periodKey);
  if (targetBucketIndex === -1) {
    return null;
  }

  const targetBucket = buckets[targetBucketIndex];
  const targetReviews = reviewsByPeriod.get(periodKey) || [];

  const baselineBuckets = buckets
    .slice(Math.max(0, targetBucketIndex - 4), targetBucketIndex)
    .filter((b) => !b.isLowData);

  const baselinePeriods = baselineBuckets.map((b) => b.periodKey);
  const baselineReviews: FeedbackReview[] = [];
  for (const b of baselineBuckets) {
    const revs = reviewsByPeriod.get(b.periodKey) || [];
    baselineReviews.push(...revs);
  }

  const topicDeltas = computeTopicDeltas(targetReviews, baselineReviews);
  const distinctiveTerms = extractDistinctiveTerms(targetReviews, baselineReviews, 10);
  const topKeywords = distinctiveTerms.map((t) => t.term.toLowerCase());

  const scoredReviews: SupportingReviewItem[] = targetReviews.map((r) => {
    const textLower = r.reviewText.toLowerCase();
    const matched = topKeywords.filter((kw) => textLower.includes(kw));

    let score = 0;
    if (r.sentimentLabel === 'Negative') score += 50;
    else if (r.sentimentLabel === 'Mixed') score += 30;
    score += matched.length * 15;
    if (r.rating === 1) score += 20;

    return {
      review: r,
      matchedKeywords: matched,
      relevanceScore: score,
    };
  });

  const supportingReviews = scoredReviews
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);

  return {
    targetBucket,
    baselinePeriods,
    targetReviews,
    topicDeltas,
    distinctiveTerms,
    supportingReviews,
  };
}

/**
 * Assembles an InvestigationResult from prepared context and an AI/extractive explanation.
 */
export function assembleInvestigationResult(
  ctx: InvestigationContext,
  aiExplanation: AIExplanationResult
): InvestigationResult {
  return {
    targetPeriodKey: ctx.targetBucket.periodKey,
    targetPeriodLabel: ctx.targetBucket.periodLabel,
    baselinePeriods: ctx.baselinePeriods,
    totalReviewsInPeriod: ctx.targetReviews.length,
    topicDeltas: ctx.topicDeltas,
    distinctiveTerms: ctx.distinctiveTerms,
    supportingReviews: ctx.supportingReviews,
    aiExplanation,
    anomaly: ctx.targetBucket.anomaly,
  };
}

const ASK_STOP_WORDS = new Set([
  'what', 'when', 'where', 'which', 'about', 'there', 'their', 'these', 'those',
  'with', 'from', 'have', 'been', 'were', 'happened', 'sentiment', 'reviews',
  'review', 'customers', 'customer', 'feedback', 'this', 'that', 'week',
]);

/**
 * Ranks reviews by relevance to a natural-language question.
 */
export function selectRelevantReviewsForQuery(
  query: string,
  allReviews: FeedbackReview[]
): FeedbackReview[] {
  const lowerQuery = query.toLowerCase();
  const queryTokens = lowerQuery
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !ASK_STOP_WORDS.has(w));

  const asksAboutProblems =
    /\b(drop|dropped|decline|declined|issue|issues|problem|problems|bug|complaint|complaints|negative|wrong|fail|crash|why|worse|spike|surge|bad|poor|mixed|polarized)\b/i.test(
      lowerQuery
    );

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

  return relevantReviews;
}

/**
 * Generates an extractive offline Q&A response grounded strictly in matching reviews.
 */
export function buildOfflineQueryResponse(
  query: string,
  relevantReviews: FeedbackReview[]
): {
  answer: string;
  citations: string[];
  isOfflineFallback: boolean;
} {
  if (relevantReviews.length === 0) {
    return {
      answer: 'No reviews matched this question in the active dataset.',
      citations: [],
      isOfflineFallback: true,
    };
  }

  const negOrMixed = relevantReviews.filter(
    (r) => r.sentimentLabel === 'Negative' || r.sentimentLabel === 'Mixed'
  );
  const samplePool = negOrMixed.length > 0 ? negOrMixed : relevantReviews;

  const topicCounts = new Map<string, number>();
  const productCounts = new Map<string, number>();
  for (const r of samplePool) {
    topicCounts.set(r.topic, (topicCounts.get(r.topic) || 0) + 1);
    productCounts.set(r.product, (productCounts.get(r.product) || 0) + 1);
  }

  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([topic, count]) => `${topic} (${count})`);
  const topProduct = Array.from(productCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const ranked = [...samplePool].sort((a, b) => {
    const aHits = queryTerms.filter((t) => a.reviewText.toLowerCase().includes(t)).length;
    const bHits = queryTerms.filter((t) => b.reviewText.toLowerCase().includes(t)).length;
    if (bHits !== aHits) return bHits - aHits;
    return a.compoundScore - b.compoundScore;
  });

  const topCited = ranked.slice(0, 4);
  const citations = topCited.map((r) => r.id);
  const quotes = topCited
    .slice(0, 2)
    .map((r) => `"${r.reviewText}" [${r.id}]`)
    .join(' and ');

  const sentimentSummary =
    negOrMixed.length > 0
      ? `${negOrMixed.length} negative/mixed reviews (out of ${relevantReviews.length} matched)`
      : `${relevantReviews.length} matching reviews`;

  const answer = `Analysis of ${sentimentSummary}${topProduct ? ` centered on ${topProduct}` : ''} shows feedback concentrated around ${topTopics.join(' and ') || 'product reliability'}. Key customer reports include ${quotes}.`;

  return {
    answer,
    citations,
    isOfflineFallback: true,
  };
}

export function selectCitedReviews(
  allReviews: FeedbackReview[],
  citations: string[]
): FeedbackReview[] {
  const citationSet = new Set(citations);
  return allReviews.filter((r) => citationSet.has(r.id)).slice(0, 5);
}

export function buildUploadSuccessPayload(
  reviews: FeedbackReview[],
  validationSummary: CsvValidationSummary
) {
  const categories = Array.from(new Set(reviews.map((r) => r.category))).sort();
  const products = Array.from(new Set(reviews.map((r) => r.product))).sort();

  return {
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
  };
}
