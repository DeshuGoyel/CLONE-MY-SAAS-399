import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';
import { generateRequestId } from '@/lib/apiHelpers';
import { withRateLimit } from '@/middleware/rateLimit';
import { getTaskStatus } from '@/action/getTaskStatus';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = generateRequestId();
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.warn('Unauthorized task status request', { requestId });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('Task status request initiated', {
      requestId,
      userId: user.id,
    });

    const tasks = await getTaskStatus(user.id);

    logger.info('Task status retrieved successfully', {
      requestId,
      userId: user.id,
      taskCount: tasks.length,
    });

    return NextResponse.json({
      success: true,
      tasks,
      requestId,
    });
  } catch (error: any) {
    logger.error('Task status error', {
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
  return withRateLimit(request, GET, {
    userIdExtractor: async (req: Request) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    limitType: 'user',
  });
}