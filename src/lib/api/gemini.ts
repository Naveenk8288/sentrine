import {
  buildOfflineQueryResponse,
  generateExtractiveFallback,
} from '../analysis/engine';
import { DistinctiveTerm, FeedbackReview, TopicDelta } from '../analysis/types';

export interface GroundedCauseResult {
  likelyCause: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  citations: string[];
  eventDetectiveHypothesis?: string;
  isOfflineFallback: boolean;
}

/**
 * Generates an evidence-grounded root cause explanation using Gemini API (or offline fallback).
 */
export async function generateGroundedCause(
  targetReviews: FeedbackReview[],
  topicDeltas: TopicDelta[],
  distinctiveTerms: DistinctiveTerm[]
): Promise<GroundedCauseResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    return generateExtractiveFallback(targetReviews, topicDeltas, distinctiveTerms);
  }

  try {
    const contextReviews = targetReviews.slice(0, 15).map((r) => ({
      id: r.id,
      product: r.product,
      date: r.date,
      rating: r.rating,
      sentiment: r.sentimentLabel,
      text: r.reviewText,
    }));

    const prompt = `You are a strict data-driven customer sentiment investigator.
You are given a list of customer reviews from a period where customer sentiment dropped significantly.

GROUNDING RULES (MANDATORY):
1. Base your findings ONLY on the provided reviews below. Do NOT assume facts not present in the text.
2. If evidence is weak or insufficient, explicitly assign "LOW" confidence rather than speculating.
3. Every claim must cite the specific review IDs in brackets like [REV-1002].
4. Formulate an "eventDetectiveHypothesis" if there is an identifiable external event (such as a firmware update, version release, courier delay, or price hike).

Top topic shifts vs baseline:
${topicDeltas.slice(0, 3).map((d) => `- ${d.topic}: +${d.deltaPercentagePoints} percentage points`).join('\n')}

Top distinctive terms:
${distinctiveTerms.slice(0, 5).map((t) => `- "${t.term}" (${t.targetFrequency}% in period vs ${t.baselineFrequency}% baseline)`).join('\n')}

Retrieved Reviews:
${JSON.stringify(contextReviews, null, 2)}

Respond with STRICT JSON format:
{
  "likelyCause": "2-3 sentences explaining exactly what happened and why customers are upset, with review ID citations like [REV-xxx]",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "citations": ["REV-xxx", "REV-yyy"],
  "eventDetectiveHypothesis": "e.g. Likely trigger: firmware update v3.2..."
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      console.warn('Gemini API returned error status, falling back to extractive engine:', response.status);
      return generateExtractiveFallback(targetReviews, topicDeltas, distinctiveTerms);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return generateExtractiveFallback(targetReviews, topicDeltas, distinctiveTerms);
    }

    const parsed = JSON.parse(rawText);
    return {
      likelyCause: parsed.likelyCause || 'Sentiment decline observed.',
      confidence: parsed.confidence || 'MEDIUM',
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      eventDetectiveHypothesis: parsed.eventDetectiveHypothesis,
      isOfflineFallback: false,
    };
  } catch (err) {
    console.error('Failed to call Gemini API, using offline fallback:', err);
    return generateExtractiveFallback(targetReviews, topicDeltas, distinctiveTerms);
  }
}

/**
 * Natural language Q&A answering grounded strictly in retrieved reviews.
 */
export async function answerCustomerQuery(
  query: string,
  relevantReviews: FeedbackReview[]
): Promise<{
  answer: string;
  citations: string[];
  isOfflineFallback: boolean;
}> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    return buildOfflineQueryResponse(query, relevantReviews);
  }

  try {
    const context = relevantReviews.slice(0, 20).map((r) => ({
      id: r.id,
      date: r.date,
      product: r.product,
      rating: r.rating,
      sentiment: r.sentimentLabel,
      text: r.reviewText,
    }));

    const prompt = `You are SentinelAI. Answer the user's question about customer sentiment using ONLY the provided reviews.
Question: "${query}"

Grounding rules:
1. Cite review IDs in brackets like [REV-1002].
2. Do not fabricate facts.
3. Return JSON:
{
  "answer": "Clear explanation citing reviews [REV-xxx]",
  "citations": ["REV-xxx"]
}

Reviews:
${JSON.stringify(context, null, 2)}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawText);

    return {
      answer: parsed.answer,
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      isOfflineFallback: false,
    };
  } catch (err) {
    console.warn('Gemini query error, returning offline answer:', err);
    return buildOfflineQueryResponse(query, relevantReviews);
  }
}
