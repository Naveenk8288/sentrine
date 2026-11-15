import test from 'node:test';
import assert from 'node:assert';
import { scoreSentiment, splitIntoClauses } from '../lib/analysis/sentiment';
import { detectChanges } from '../lib/analysis/anomalyDetector';
import { computeTopicDeltas } from '../lib/analysis/topicDelta';
import { getPeriodKey } from '../lib/analysis/timeAggregator';
import { parseAndAnalyzeCSV } from '../lib/db/store';
import { TimeBucket, FeedbackReview } from '../lib/analysis/types';

test('Sentiment: Clause splitting identifies contrastive clauses', () => {
  const text = 'The audio quality is fantastic, but the battery drains in under two hours.';
  const clauses = splitIntoClauses(text);
  assert.ok(clauses.length >= 2, `Expected at least 2 clauses, got: ${clauses.length}`);
});

test('Sentiment: Edge Case 2 (Mixed Sentiment) correctly detected when opposing polarities exist', () => {
  const text = 'The sound clarity is truly amazing, but customer support was horribly rude and unresponsive.';
  const result = scoreSentiment(text);
  assert.strictEqual(result.sentimentLabel, 'Mixed');
  assert.ok(result.clauseScores.length >= 2);
  assert.ok(result.clauseScores.some(c => c.score >= 0.25), 'Should have a positive clause');
  assert.ok(result.clauseScores.some(c => c.score <= -0.25), 'Should have a negative clause');
});

test('Sentiment: Standard positive and negative classifications work', () => {
  const pos = scoreSentiment('Absolutely love this product! Fast shipping and works like a dream.');
  assert.strictEqual(pos.sentimentLabel, 'Positive');
  assert.ok(pos.compoundScore > 0.4);

  const neg = scoreSentiment('Terrible experience. Broke on the first day and completely useless.');
  assert.strictEqual(neg.sentimentLabel, 'Negative');
  assert.ok(neg.compoundScore < -0.4);
});

test('Anomaly Detector: Edge Case 1 (Low data periods do NOT trigger false alarms)', () => {
  const mockBuckets: TimeBucket[] = [
    {
      periodKey: '2024-W01',
      periodLabel: 'W1',
      startDate: '2024-01-01',
      endDate: '2024-01-07',
      totalCount: 50,
      avgSentiment: 0.60,
      netSentimentScore: 70,
      sentimentCounts: { positive: 40, neutral: 5, negative: 3, mixed: 2 },
      sentimentShares: { positive: 80, neutral: 10, negative: 6, mixed: 4 },
      topicDistribution: { 'Delivery': 5, 'Product Quality': 10, 'Battery & Power': 5, 'Software/Updates': 5, 'Customer Support': 5, 'Pricing': 5, 'Performance': 10, 'Other': 5 },
      topicShares: { 'Delivery': 10, 'Product Quality': 20, 'Battery & Power': 10, 'Software/Updates': 10, 'Customer Support': 10, 'Pricing': 10, 'Performance': 20, 'Other': 10 },
      confidenceBand: { lower: 0.50, upper: 0.70 },
      isLowData: false,
      polarizationIndex: 0.1,
    },
    {
      // Low volume week: only 2 reviews, both negative (-0.80)
      periodKey: '2024-W02',
      periodLabel: 'W2',
      startDate: '2024-01-08',
      endDate: '2024-01-14',
      totalCount: 2,
      avgSentiment: -0.80,
      netSentimentScore: -100,
      sentimentCounts: { positive: 0, neutral: 0, negative: 2, mixed: 0 },
      sentimentShares: { positive: 0, neutral: 0, negative: 100, mixed: 0 },
      topicDistribution: { 'Delivery': 0, 'Product Quality': 2, 'Battery & Power': 0, 'Software/Updates': 0, 'Customer Support': 0, 'Pricing': 0, 'Performance': 0, 'Other': 0 },
      topicShares: { 'Delivery': 0, 'Product Quality': 100, 'Battery & Power': 0, 'Software/Updates': 0, 'Customer Support': 0, 'Pricing': 0, 'Performance': 0, 'Other': 0 },
      confidenceBand: { lower: -1.0, upper: -0.4 },
      isLowData: false, // will be evaluated by detectChanges
      polarizationIndex: 0.0,
    },
  ];

  const results = detectChanges(mockBuckets);
  assert.strictEqual(results[1].isLowData, true, 'W2 should be marked isLowData');
  assert.strictEqual(results[1].anomaly, undefined, 'W2 must NOT raise an anomaly due to low volume');
});

test('Anomaly Detector: Edge Case 3 (Isolated event flagged when negative reviews < 3)', () => {
  const w1: TimeBucket = {
    periodKey: '2024-W01',
    periodLabel: 'W1',
    startDate: '2024-01-01',
    endDate: '2024-01-07',
    totalCount: 50,
    avgSentiment: 0.60,
    netSentimentScore: 70,
    sentimentCounts: { positive: 40, neutral: 5, negative: 3, mixed: 2 },
    sentimentShares: { positive: 80, neutral: 10, negative: 6, mixed: 4 },
    topicDistribution: { 'Delivery': 5, 'Product Quality': 10, 'Battery & Power': 5, 'Software/Updates': 5, 'Customer Support': 5, 'Pricing': 5, 'Performance': 10, 'Other': 5 },
    topicShares: { 'Delivery': 10, 'Product Quality': 20, 'Battery & Power': 10, 'Software/Updates': 10, 'Customer Support': 10, 'Pricing': 10, 'Performance': 20, 'Other': 10 },
    confidenceBand: { lower: 0.50, upper: 0.70 },
    isLowData: false,
    polarizationIndex: 0.1,
  };

  const w2: TimeBucket = {
    periodKey: '2024-W02',
    periodLabel: 'W2',
    startDate: '2024-01-08',
    endDate: '2024-01-14',
    totalCount: 8, // Passes minVolumeThreshold (>=5)
    avgSentiment: 0.10, // Drops by 0.50!
    netSentimentScore: -10,
    sentimentCounts: { positive: 3, neutral: 3, negative: 2, mixed: 0 }, // Only 2 negative reviews!
    sentimentShares: { positive: 37.5, neutral: 37.5, negative: 25.0, mixed: 0 },
    topicDistribution: { 'Delivery': 2, 'Product Quality': 2, 'Battery & Power': 1, 'Software/Updates': 1, 'Customer Support': 1, 'Pricing': 1, 'Performance': 0, 'Other': 0 },
    topicShares: { 'Delivery': 25, 'Product Quality': 25, 'Battery & Power': 12.5, 'Software/Updates': 12.5, 'Customer Support': 12.5, 'Pricing': 12.5, 'Performance': 0, 'Other': 0 },
    confidenceBand: { lower: -0.1, upper: 0.3 },
    isLowData: false,
    polarizationIndex: 0.2,
  };

  const reviewMap = new Map<string, FeedbackReview[]>([
    [
      '2024-W02',
      [
        {
          id: 'REV-VIRAL-1',
          date: '2024-01-09',
          product: 'EchoPulse Pro',
          category: 'Audio',
          reviewText: 'Horrible experience, device started smoking!',
          sentimentLabel: 'Negative',
          compoundScore: -0.95,
          topic: 'Product Quality',
        },
      ],
    ],
  ]);

  const results = detectChanges([w1, w2], reviewMap);
  assert.ok(results[1].anomaly, 'Should flag an anomaly');
  assert.strictEqual(results[1].anomaly?.type, 'ISOLATED_EVENT', 'Must be classified as ISOLATED_EVENT');
  assert.strictEqual(results[1].anomaly?.drivingReviewId, 'REV-VIRAL-1', 'Must point to driving review');
  assert.ok(results[1].anomaly?.scoreDrop >= 0.5, 'Score drop magnitude must be positive');
});

test('Anomaly Detector: Sustained decline flagged when drop >= 0.25 and negative reviews >= 3', () => {
  const w1: TimeBucket = {
    periodKey: '2024-W01',
    periodLabel: 'W1',
    startDate: '2024-01-01',
    endDate: '2024-01-07',
    totalCount: 60,
    avgSentiment: 0.55,
    netSentimentScore: 70,
    sentimentCounts: { positive: 50, neutral: 6, negative: 4, mixed: 0 },
    sentimentShares: { positive: 83.3, neutral: 10, negative: 6.7, mixed: 0 },
    topicDistribution: { 'Delivery': 5, 'Product Quality': 10, 'Battery & Power': 5, 'Software/Updates': 5, 'Customer Support': 5, 'Pricing': 5, 'Performance': 10, 'Other': 15 },
    topicShares: { 'Delivery': 8.3, 'Product Quality': 16.7, 'Battery & Power': 8.3, 'Software/Updates': 8.3, 'Customer Support': 8.3, 'Pricing': 8.3, 'Performance': 16.7, 'Other': 25 },
    confidenceBand: { lower: 0.45, upper: 0.65 },
    isLowData: false,
    polarizationIndex: 0.1,
  };

  const w2: TimeBucket = {
    periodKey: '2024-W02',
    periodLabel: 'W2',
    startDate: '2024-01-08',
    endDate: '2024-01-14',
    totalCount: 70,
    avgSentiment: -0.20, // Huge drop from +0.55
    netSentimentScore: -50,
    sentimentCounts: { positive: 10, neutral: 10, negative: 50, mixed: 0 }, // 50 negative reviews
    sentimentShares: { positive: 14.3, neutral: 14.3, negative: 71.4, mixed: 0 },
    topicDistribution: { 'Delivery': 5, 'Product Quality': 5, 'Battery & Power': 25, 'Software/Updates': 30, 'Customer Support': 2, 'Pricing': 1, 'Performance': 2, 'Other': 0 },
    topicShares: { 'Delivery': 7.1, 'Product Quality': 7.1, 'Battery & Power': 35.7, 'Software/Updates': 42.9, 'Customer Support': 2.9, 'Pricing': 1.4, 'Performance': 2.9, 'Other': 0 },
    confidenceBand: { lower: -0.35, upper: -0.05 },
    isLowData: false,
    polarizationIndex: 0.2,
  };

  const results = detectChanges([w1, w2]);
  assert.ok(results[1].anomaly, 'Should detect anomaly');
  assert.strictEqual(results[1].anomaly?.type, 'SUSTAINED_DECLINE');
  assert.strictEqual(results[1].anomaly?.severity, 'HIGH');
  assert.ok(results[1].anomaly?.scoreDrop > 0.7);
});

test('Topic Delta: Computes percentage point difference on shares, not raw counts', () => {
  const baseline: FeedbackReview[] = [
    { id: 'b1', date: '2024-01-01', product: 'P', category: 'C', reviewText: 'Good', sentimentLabel: 'Positive', compoundScore: 0.8, topic: 'Delivery' },
    { id: 'b2', date: '2024-01-01', product: 'P', category: 'C', reviewText: 'Good', sentimentLabel: 'Positive', compoundScore: 0.8, topic: 'Product Quality' },
    { id: 'b3', date: '2024-01-01', product: 'P', category: 'C', reviewText: 'Good', sentimentLabel: 'Positive', compoundScore: 0.8, topic: 'Performance' },
    { id: 'b4', date: '2024-01-01', product: 'P', category: 'C', reviewText: 'Good', sentimentLabel: 'Positive', compoundScore: 0.8, topic: 'Software/Updates' },
  ]; // Software/Updates = 1/4 = 25%

  const target: FeedbackReview[] = [
    { id: 't1', date: '2024-01-08', product: 'P', category: 'C', reviewText: 'Buggy firmware update', sentimentLabel: 'Negative', compoundScore: -0.6, topic: 'Software/Updates' },
    { id: 't2', date: '2024-01-08', product: 'P', category: 'C', reviewText: 'App crashed after update', sentimentLabel: 'Negative', compoundScore: -0.7, topic: 'Software/Updates' },
    { id: 't3', date: '2024-01-08', product: 'P', category: 'C', reviewText: 'Bluetooth broke', sentimentLabel: 'Negative', compoundScore: -0.5, topic: 'Software/Updates' },
    { id: 't4', date: '2024-01-08', product: 'P', category: 'C', reviewText: 'Okay', sentimentLabel: 'Neutral', compoundScore: 0.0, topic: 'Product Quality' },
  ]; // Software/Updates = 3/4 = 75%

  const deltas = computeTopicDeltas(target, baseline);
  const swDelta = deltas.find(d => d.topic === 'Software/Updates');
  assert.ok(swDelta, 'Should contain Software/Updates');
  assert.strictEqual(swDelta.baselineShare, 25);
  assert.strictEqual(swDelta.currentShare, 75);
  assert.strictEqual(swDelta.deltaPercentagePoints, 50); // 75 - 25 = +50 pts
  assert.strictEqual(swDelta.isSurge, true);
});

test('Time Aggregator: Monthly & Weekly boundaries preserve exact end-of-month and leap dates in UTC', () => {
  const jan31 = getPeriodKey('2024-01-31', 'monthly');
  assert.strictEqual(jan31.key, '2024-01');
  assert.strictEqual(jan31.startDate, '2024-01-01');
  assert.strictEqual(jan31.endDate, '2024-01-31');

  const feb29 = getPeriodKey('2024-02-29', 'monthly');
  assert.strictEqual(feb29.key, '2024-02');
  assert.strictEqual(feb29.endDate, '2024-02-29');

  const wk = getPeriodKey('2024-01-14', 'weekly');
  assert.strictEqual(wk.key, '2024-W02');
  assert.strictEqual(wk.startDate, '2024-01-08');
  assert.strictEqual(wk.endDate, '2024-01-14');
});

test('Store: parseAndAnalyzeCSV preserves exact YYYY-MM-DD and normalizes slash dates without timezone shift', () => {
  const csv = [
    'id,date,product,category,rating,review_text',
    'REV-1,2024-01-31,EchoPulse Pro,Audio,1,"Firmware update broke Bluetooth."',
    'REV-2,02/29/2024,Lumina Glow,Home,5,"Bright lamp and fast delivery."',
  ].join('\n');

  const { reviews, validationSummary } = parseAndAnalyzeCSV(csv);
  assert.strictEqual(validationSummary.validRows, 2);
  assert.strictEqual(reviews[0].date, '2024-01-31');
  assert.strictEqual(reviews[1].date, '2024-02-29');
});
