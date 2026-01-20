import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';
import { cache, cacheKeys } from '@/lib/cache';
import { generateRequestId } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

interface AnalyticsData {
  totalImages: number;
  imagesByPlan: Record<string, number>;
  generationTimeline: Array<{ date: string; count: number }>;
  creditsUsed: number;
  creditsAvailable: number;
  averageGenerationTime: number;
  downloadCount: number;
  planType: string;
}

export async function GET(request: Request) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.warn('Unauthorized analytics request', { requestId });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cacheKey = cacheKeys.userMetrics(user.id);
    const cached = cache.get<AnalyticsData>(cacheKey);

    if (cached) {
      logger.debug('Analytics cache hit', { requestId, userId: user.id });
      return NextResponse.json(cached);
    }

    const { data: userData, error } = await supabase
      .from('userTable')
      .select('promptsResult, planType, downloadHistory, created_at, submissionDate')
      .eq('id', user.id)
      .single();

    if (error || !userData) {
      logger.error('Error fetching user data for analytics', {
        requestId,
        userId: user.id,
        error: error?.message,
      });
      return NextResponse.json(
        { error: 'Failed to fetch analytics data' },
        { status: 500 }
      );
    }

    const promptsResult = Array.isArray(userData.promptsResult) 
      ? userData.promptsResult 
      : [];

    const getAllowedPrompts = (planType: string): number => {
      switch (planType.toLowerCase()) {
        case 'professional':
          return 100;
        case 'executive':
          return 200;
        case 'basic':
        default:
          return 10;
      }
    };

    const planType = userData.planType || 'basic';
    const totalImages = promptsResult.reduce((acc, result) => {
      const images = result.data?.prompt?.images || [];
      return acc + images.length;
    }, 0);

    const generationTimeline = promptsResult.map((result) => ({
      date: result.timestamp,
      count: result.data?.prompt?.images?.length || 0,
    }));

    const downloadHistory = Array.isArray(userData.downloadHistory) 
      ? userData.downloadHistory 
      : [];

    const analytics: AnalyticsData = {
      totalImages,
      imagesByPlan: {
        [planType]: totalImages,
      },
      generationTimeline,
      creditsUsed: promptsResult.length,
      creditsAvailable: getAllowedPrompts(planType) - promptsResult.length,
      averageGenerationTime: 0,
      downloadCount: downloadHistory.length,
      planType,
    };

    cache.set(cacheKey, analytics, 60);

    const duration = Date.now() - startTime;
    logger.info('Analytics generated successfully', {
      requestId,
      userId: user.id,
      duration,
    });

    return NextResponse.json(analytics);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Analytics error', {
      requestId,
      error: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
