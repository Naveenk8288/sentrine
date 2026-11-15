import { FeedbackTopic } from './types';

interface TopicRule {
  topic: FeedbackTopic;
  keywords: string[];
  weight?: number;
}

const TOPIC_RULES: TopicRule[] = [
  {
    topic: 'Software/Updates',
    keywords: [
      'firmware',
      'update',
      'patch',
      'software',
      'app',
      'bluetooth',
      'sync',
      'disconnect',
      'pairing',
      'bug',
      'glitch',
      'crash',
      'bricked',
      'v3.2',
      'connection',
      'unresponsive',
      'reboot',
      'wifi',
    ],
    weight: 1.2,
  },
  {
    topic: 'Battery & Power',
    keywords: [
      'battery',
      'drain',
      'draining',
      'charge',
      'charging',
      'charger',
      'power',
      'overheating',
      'hot',
      'heat',
      'dead',
      'runtime',
      'hours',
      'standby',
      'discharge',
    ],
    weight: 1.2,
  },
  {
    topic: 'Delivery',
    keywords: [
      'delivery',
      'shipping',
      'shipment',
      'courier',
      'delayed',
      'delay',
      'late',
      'package',
      'damaged box',
      'transit',
      'arrived',
      'customs',
      'lost',
      'tracking',
      'undelivered',
    ],
    weight: 1.1,
  },
  {
    topic: 'Customer Support',
    keywords: [
      'support',
      'customer service',
      'agent',
      'representative',
      'refund',
      'return',
      'warranty',
      'ticket',
      'rude',
      'helpful',
      'response',
      'ignored',
      'chat',
      'help desk',
      'repair',
    ],
    weight: 1.1,
  },
  {
    topic: 'Pricing',
    keywords: [
      'price',
      'pricing',
      'expensive',
      'cost',
      'worth',
      'value',
      'money',
      'rip off',
      'overpriced',
      'cheap price',
      'affordable',
      'bargain',
      'deal',
    ],
    weight: 1.0,
  },
  {
    topic: 'Product Quality',
    keywords: [
      'build quality',
      'material',
      'plastic',
      'cheap feeling',
      'flimsy',
      'broke',
      'broken',
      'crack',
      'cracked',
      'durability',
      'sturdy',
      'solid',
      'scratch',
      'defect',
      'finish',
    ],
    weight: 1.0,
  },
  {
    topic: 'Performance',
    keywords: [
      'performance',
      'speed',
      'slow',
      'fast',
      'lag',
      'audio quality',
      'sound',
      'bass',
      'treble',
      'clarity',
      'screen',
      'display',
      'suction',
      'clean',
      'resolution',
      'volume',
      'latency',
    ],
    weight: 1.0,
  },
];

export interface TopicClassificationResult {
  topic: FeedbackTopic;
  confidence: number;
  matchedKeywords: string[];
}

/**
 * Classifies feedback text into one of the 8 canonical topics.
 */
export function extractTopic(text: string): TopicClassificationResult {
  if (!text || text.trim() === '') {
    return {
      topic: 'Other',
      confidence: 0,
      matchedKeywords: [],
    };
  }

  const lowerText = text.toLowerCase();
  let bestTopic: FeedbackTopic = 'Other';
  let bestScore = 0;
  let bestMatches: string[] = [];

  for (const rule of TOPIC_RULES) {
    const matches: string[] = [];
    let score = 0;

    for (const kw of rule.keywords) {
      // Word boundary match where applicable or substring for compound phrases
      const regex = new RegExp(`\\b${kw.replace('.', '\\.')}\\b`, 'i');
      if (regex.test(lowerText) || lowerText.includes(kw)) {
        matches.push(kw);
        score += (rule.weight || 1.0);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTopic = rule.topic;
      bestMatches = matches;
    }
  }

  if (bestScore === 0) {
    return {
      topic: 'Other',
      confidence: 0.3,
      matchedKeywords: [],
    };
  }

  const confidence = Math.min(1, 0.4 + bestScore * 0.2);

  return {
    topic: bestTopic,
    confidence: Number(confidence.toFixed(2)),
    matchedKeywords: bestMatches,
  };
}
