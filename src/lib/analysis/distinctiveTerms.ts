import { DistinctiveTerm, FeedbackReview } from './types';

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can\'t',
  'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t',
  'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it',
  'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s',
  'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
  'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s',
  'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re',
  'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'really', 'just', 'get', 'got', 'even', 'one', 'also',
  'product', 'item', 'bought', 'ordered', 'purchased', 'using', 'used', 'use', 'like', 'good', 'great',
]);

/**
 * Tokenizes text into meaningful words and bigrams.
 */
function extractTokens(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s.-]/g, ' ');
  const words = clean
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

  const tokens: string[] = [...words];

  // Also include 2-word collocations (bigrams) e.g., "battery drain", "firmware update"
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    tokens.push(bigram);
  }

  return tokens;
}

/**
 * Computes the top distinctive terms in the target period relative to baseline.
 */
export function extractDistinctiveTerms(
  targetReviews: FeedbackReview[],
  baselineReviews: FeedbackReview[],
  maxTerms: number = 8
): DistinctiveTerm[] {
  const targetCount = targetReviews.length;
  const baselineCount = baselineReviews.length;

  if (targetCount === 0) return [];

  const targetFreq = new Map<string, number>();
  const baselineFreq = new Map<string, number>();

  for (const r of targetReviews) {
    const seen = new Set(extractTokens(r.reviewText));
    for (const token of seen) {
      targetFreq.set(token, (targetFreq.get(token) || 0) + 1);
    }
  }

  for (const r of baselineReviews) {
    const seen = new Set(extractTokens(r.reviewText));
    for (const token of seen) {
      baselineFreq.set(token, (baselineFreq.get(token) || 0) + 1);
    }
  }

  const results: DistinctiveTerm[] = [];

  for (const [term, tCount] of targetFreq.entries()) {
    // Only consider terms appearing in at least 2 reviews or at least 10% of target reviews
    if (tCount < 2 && tCount / targetCount < 0.1) continue;

    const bCount = baselineFreq.get(term) || 0;
    const tRate = tCount / targetCount;
    const bRate = baselineCount > 0 ? bCount / baselineCount : 0.001;

    // Smoothed relative lift / difference score
    // Boosted if frequent in target and absent/rare in baseline
    const lift = (tRate + 0.01) / (bRate + 0.01);
    const difference = tRate - bRate;
    const score = Number((difference * Math.log2(lift + 1) * 100).toFixed(2));

    if (score > 1.0) {
      results.push({
        term,
        targetCount: tCount,
        baselineCount: bCount,
        targetFrequency: Number((tRate * 100).toFixed(1)),
        baselineFrequency: Number((bRate * 100).toFixed(1)),
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxTerms);
}
