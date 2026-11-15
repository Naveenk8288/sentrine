import vader from 'vader-sentiment';
import { ClauseScore, SentimentLabel } from './types';

const CONTRASTIVE_REGEX = /\b(but|however|although|yet|nevertheless|though|on the other hand)\b|[;]/i;

/**
 * Splits text into logical clauses based on contrastive conjunctions and semicolons.
 */
export function splitIntoClauses(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  // Split on punctuation or contrast words
  const rawParts = text.split(CONTRASTIVE_REGEX);
  const clauses: string[] = [];

  for (const part of rawParts) {
    if (!part) continue;
    const trimmed = part.trim();
    // Skip matched single contrast words if captured
    if (/^(but|however|although|yet|nevertheless|though|on the other hand|;)$/i.test(trimmed)) {
      continue;
    }
    if (trimmed.length > 2) {
      clauses.push(trimmed);
    }
  }

  return clauses.length > 0 ? clauses : [text.trim()];
}

export interface SentimentAnalysisResult {
  sentimentLabel: SentimentLabel;
  compoundScore: number;
  clauseScores: ClauseScore[];
}

/**
 * Scores sentiment with clause-level decomposition to accurately detect Mixed sentiment.
 * Enforces Edge Case 2: One clause positive and one negative -> "Mixed".
 */
export function scoreSentiment(text: string): SentimentAnalysisResult {
  if (!text || text.trim() === '') {
    return {
      sentimentLabel: 'Neutral',
      compoundScore: 0,
      clauseScores: [],
    };
  }

  const overallScores = vader.SentimentIntensityAnalyzer.polarity_scores(text);
  const clauses = splitIntoClauses(text);
  
  const clauseScores: ClauseScore[] = clauses.map((clause) => {
    const scores = vader.SentimentIntensityAnalyzer.polarity_scores(clause);
    return {
      clause,
      score: scores.compound,
    };
  });

  // Check for Mixed Sentiment (Edge Case 2)
  // At least one distinctly positive clause and at least one distinctly negative clause
  const hasStrongPositiveClause = clauseScores.some((c) => c.score >= 0.25);
  const hasStrongNegativeClause = clauseScores.some((c) => c.score <= -0.25);

  let sentimentLabel: SentimentLabel;

  if (clauseScores.length > 1 && hasStrongPositiveClause && hasStrongNegativeClause) {
    sentimentLabel = 'Mixed';
  } else {
    // Standard VADER thresholding
    if (overallScores.compound >= 0.05) {
      sentimentLabel = 'Positive';
    } else if (overallScores.compound <= -0.05) {
      sentimentLabel = 'Negative';
    } else {
      sentimentLabel = 'Neutral';
    }
  }

  return {
    sentimentLabel,
    compoundScore: Number(overallScores.compound.toFixed(4)),
    clauseScores,
  };
}
