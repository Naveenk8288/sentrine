import { getErrorMessage } from '../analysis/types';

export interface AnomalyAlertPayload {
  periodLabel: string;
  anomalyType: string;
  severity: string;
  scoreDrop: number;
  negativeShareSurge: number;
  topTopicDelta: string;
  investigationUrl?: string;
  sampleEvidenceText?: string;
}

/**
 * Sends a rich formatted alert to a Slack or Discord webhook.
 */
export async function sendWebhookAlert(
  payload: AnomalyAlertPayload,
  customWebhookUrl?: string
): Promise<{ success: boolean; message: string }> {
  const url = customWebhookUrl || process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;

  if (!url || url.trim() === '') {
    return {
      success: true,
      message: 'Demo Simulation: Webhook triggered successfully! (Configure SLACK_WEBHOOK_URL in .env or enter a Slack/Discord webhook URL to send to real channels)',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return { success: false, message: 'Webhook URL must use http:// or https://' };
    }
  } catch {
    return { success: false, message: 'Invalid webhook URL format' };
  }

  const isDiscord = parsedUrl.hostname.includes('discord.com') || parsedUrl.hostname.includes('discordapp.com');

  try {
    let body: Record<string, unknown>;

    if (isDiscord) {
      body = {
        embeds: [
          {
            title: `🚨 SentinelAI Alert: ${payload.severity} Sentiment Anomaly Detected`,
            description: `A significant decline in customer sentiment was detected in **${payload.periodLabel}**.`,
            color: payload.severity === 'HIGH' ? 0xff4d4f : 0xfaad14,
            fields: [
              { name: 'Drop Magnitude', value: `${payload.scoreDrop.toFixed(2)} pts`, inline: true },
              { name: 'Negative Share Surge', value: `+${payload.negativeShareSurge.toFixed(1)}%`, inline: true },
              { name: 'Top Topic Delta', value: payload.topTopicDelta, inline: true },
              { name: 'Sample Evidence', value: payload.sampleEvidenceText ? `"${payload.sampleEvidenceText.slice(0, 150)}..."` : 'Multiple reviews affected' },
            ],
            footer: { text: 'SentinelAI • AI-Based Customer Sentiment Trend Analyzer' },
          },
        ],
      };
    } else {
      // Slack Block Kit format
      body = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🚨 SentinelAI Alert: ${payload.severity} Sentiment Anomaly`,
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Period:*\n${payload.periodLabel}` },
              { type: 'mrkdwn', text: `*Severity:*\n${payload.severity}` },
              { type: 'mrkdwn', text: `*Score Drop:*\n${payload.scoreDrop.toFixed(2)} pts` },
              { type: 'mrkdwn', text: `*Neg Share Surge:*\n+${payload.negativeShareSurge.toFixed(1)}%` },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Primary Cause Topic:* ${payload.topTopicDelta}\n*Sample Quote:* "${payload.sampleEvidenceText || 'Widespread customer complaints observed.'}"`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Investigate in SentinelAI 🔍', emoji: true },
                style: 'danger',
                url: payload.investigationUrl || 'http://localhost:3000',
              },
            ],
          },
        ],
      };
    }

    const res = await fetch(parsedUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return {
        success: false,
        message: `Webhook endpoint returned HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      message: 'Alert sent successfully to webhook channel!',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: getErrorMessage(err, 'Network error triggering webhook'),
    };
  }
}
