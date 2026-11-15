import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/analysis/types';
import { sendWebhookAlert } from '@/lib/api/webhook';

interface AlertRequestBody {
  periodLabel?: string;
  anomalyType?: string;
  severity?: string;
  scoreDrop?: number;
  negativeShareSurge?: number;
  topTopicDelta?: string;
  sampleEvidenceText?: string;
  webhookUrl?: string;
  isTest?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AlertRequestBody;
    const {
      periodLabel = 'Week 7 (2024-W07)',
      anomalyType = 'SUSTAINED_DECLINE',
      severity = 'HIGH',
      scoreDrop = 0.58,
      negativeShareSurge = 42.5,
      topTopicDelta = 'Software/Updates +34.2 pts',
      sampleEvidenceText = 'Firmware update v3.2 caused severe battery drain and bluetooth disconnects.',
      webhookUrl,
      isTest = false,
    } = body;

    const result = await sendWebhookAlert(
      {
        periodLabel: isTest ? `[TEST ALERT] ${periodLabel}` : periodLabel,
        anomalyType,
        severity,
        scoreDrop,
        negativeShareSurge,
        topTopicDelta,
        sampleEvidenceText,
        investigationUrl: req.nextUrl.origin,
      },
      webhookUrl
    );

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: unknown) {
    console.error('Error in /api/alerts:', err);
    return NextResponse.json(
      { success: false, message: getErrorMessage(err, 'Failed to dispatch alert') },
      { status: 500 }
    );
  }
}
