import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';
import { generateRequestId } from '@/lib/apiHelpers';
import { isDemoUser, getDemoUserData } from '@/action/demoEmailPass';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = generateRequestId();
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.warn('Unauthorized demo status request', { requestId });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('Demo status request initiated', {
      requestId,
      userId: user.id,
    });

    const isDemo = await isDemoUser(user.id);
    let demoData = null;

    if (isDemo) {
      demoData = await getDemoUserData(user.id);
    }

    logger.info('Demo status retrieved successfully', {
      requestId,
      userId: user.id,
      isDemo,
    });

    return NextResponse.json({
      success: true,
      isDemoUser: isDemo,
      demoData,
      requestId,
    });
  } catch (error: any) {
    logger.error('Demo status error', {
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