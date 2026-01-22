import { NextResponse } from 'next/server';
import { demoEmailSchema } from '@/lib/validations';
import { logger } from '@/lib/logger';
import { generateRequestId } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = generateRequestId();
  
  try {
    const body = await request.json();
    const validation = demoEmailSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid demo email validation request', {
        requestId,
        errors: validation.error.errors,
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data', 
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    logger.info('Demo email validation request', {
      requestId,
      email,
    });

    return NextResponse.json({
      success: true,
      email,
      isValidDemoEmail: true,
      message: 'Valid demo email pattern',
      requestId,
    });
  } catch (error: any) {
    logger.error('Demo email validation error', {
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