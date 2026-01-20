import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';
import { regenerateSchema } from '@/lib/validations';
import { generateRequestId } from '@/lib/apiHelpers';
import { withRateLimit } from '@/middleware/rateLimit';

export const dynamic = 'force-dynamic';

async function handler(request: Request): Promise<NextResponse> {
  const requestId = generateRequestId();

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.warn('Unauthorized regenerate request', { requestId });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = regenerateSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid regenerate request', {
        requestId,
        userId: user.id,
        errors: validation.error.errors,
      });
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { promptIds, styleOverrides, customPrompt } = validation.data;

    const { data: userData, error } = await supabase
      .from('userTable')
      .select('promptsResult, planType, regenerationCount')
      .eq('id', user.id)
      .single();

    if (error || !userData) {
      logger.error('Error fetching user data for regeneration', {
        requestId,
        userId: user.id,
        error: error?.message,
      });
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    const getRegenerationLimit = (planType: string): number => {
      switch (planType.toLowerCase()) {
        case 'professional':
          return 50;
        case 'executive':
          return 100;
        case 'basic':
        default:
          return 5;
      }
    };

    const regenerationCount = userData.regenerationCount || 0;
    const regenerationLimit = getRegenerationLimit(userData.planType || 'basic');

    if (regenerationCount >= regenerationLimit) {
      logger.warn('Regeneration limit exceeded', {
        requestId,
        userId: user.id,
        count: regenerationCount,
        limit: regenerationLimit,
      });
      return NextResponse.json(
        { error: 'Regeneration limit exceeded for your plan' },
        { status: 403 }
      );
    }

    logger.info('Regeneration request initiated', {
      requestId,
      userId: user.id,
      promptIds,
      hasCustomPrompt: !!customPrompt,
    });

    const { error: updateError } = await supabase
      .from('userTable')
      .update({
        regenerationCount: regenerationCount + 1,
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to update regeneration count', {
        requestId,
        userId: user.id,
        error: updateError.message,
      });
    }

    return NextResponse.json({
      message: 'Regeneration queued successfully',
      requestId,
      remaining: regenerationLimit - regenerationCount - 1,
    });
  } catch (error: any) {
    logger.error('Regeneration error', {
      requestId,
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return withRateLimit(request, handler, {
    userIdExtractor: async (req) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    limitType: 'user',
  });
}
