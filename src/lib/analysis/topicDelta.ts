import {
  createEmptyTopicCounts,
  FeedbackReview,
  FeedbackTopic,
  FEEDBACK_TOPICS,
  TopicDelta,
} from './types';

/**
 * Computes topic deltas between the target period and the previous baseline (up to 4 weeks).
 * Crucially calculated as SHARE of reviews (percentage points), NOT raw counts, so volume does not distort findings.
 */
export function computeTopicDeltas(
  targetReviews: FeedbackReview[],
  baselineReviews: FeedbackReview[]
): TopicDelta[] {
  const targetCount = targetReviews.length;
  const baselineCount = baselineReviews.length;

  const targetTopicCounts: Record<FeedbackTopic, number> = createEmptyTopicCounts();
  const baselineTopicCounts: Record<FeedbackTopic, number> = createEmptyTopicCounts();

  for (const r of targetReviews) {
    if (targetTopicCounts[r.topic] !== undefined) {
      targetTopicCounts[r.topic]++;
    } else {
      targetTopicCounts['Other']++;
    }
  }

  for (const r of baselineReviews) {
    if (baselineTopicCounts[r.topic] !== undefined) {
      baselineTopicCounts[r.topic]++;
    } else {
      baselineTopicCounts['Other']++;
    }
  }

  const deltas: TopicDelta[] = FEEDBACK_TOPICS.map((topic) => {
    const curShare = targetCount > 0 ? (targetTopicCounts[topic] / targetCount) * 100 : 0;
    const baseShare = baselineCount > 0 ? (baselineTopicCounts[topic] / baselineCount) * 100 : 0;
    const deltaPts = Number((curShare - baseShare).toFixed(2));

    return {
      topic,
      baselineShare: Number(baseShare.toFixed(2)),
      currentShare: Number(curShare.toFixed(2)),
      deltaPercentagePoints: deltaPts,
      isSurge: deltaPts >= 10, // flagged if increased by 10+ percentage points
    };
  });

  // Sort by highest surge first
  return deltas.sort((a, b) => b.deltaPercentagePoints - a.deltaPercentagePoints);
}
