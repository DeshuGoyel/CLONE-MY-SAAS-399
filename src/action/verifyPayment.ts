// app/actions/verifyPayment.ts
'use server'
import { createClient } from "@/utils/supabase/server";
import { StripeHelper } from '@/lib/stripeHelper';
import { logger } from '@/lib/logger';
import { generateRequestId } from '@/lib/apiHelpers';

const stripeKey = process.env.ENVIRONMENT === 'DEVELOPMENT'
  ? process.env.STRIPE_TEST_SECRET_KEY!
  : process.env.STRIPE_SECRET_KEY!;

const stripeHelper = new StripeHelper(stripeKey, {
  maxRetries: 3,
  retryDelay: 1000,
  timeoutMs: 30000,
});

export async function verifyPayment(sessionId: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  if (!sessionId) {
    logger.warn('Missing session_id parameter', { requestId });
    throw new Error('Missing session_id parameter');
  }

  try {
    logger.info('Retrieving Stripe session', { requestId, sessionId });

    const session = await stripeHelper.retrieveSession(sessionId);

    // Extract planType from metadata
    const planType: string | undefined = session.metadata?.planType;
    const customerEmail = session.customer_details?.email;

    logger.info('Stripe session retrieved', {
      requestId,
      sessionId,
      status: session.payment_status,
      planType,
      customerEmail,
    });

    if (session.payment_status === 'paid') {
      // Update user's plan in the database
      await updatePlan({
        paymentStatus: session.payment_status,
        amount: session.amount_total ?? 0,
        planType: planType ?? 'default',
        customerEmail: customerEmail,
      }, requestId);

      logger.info('Payment successful and plan updated', {
        requestId,
        sessionId,
        planType,
      });
    }

    const duration = Date.now() - startTime;

    return {
      success: session.payment_status === 'paid',
      status: session.payment_status,
      details: {
        id: session.id,
        customer: session.customer,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
        customer_email: customerEmail,
      },
      requestId,
      duration,
    };
  } catch (error: any) {
    logger.error('Error in verifyPayment', {
      requestId,
      sessionId,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Payment verification failed: ${error.message}`);
  }
}

async function updatePlan({paymentStatus, amount, planType, customerEmail}: {
  paymentStatus: string,
  amount: number,
  planType: string,
  customerEmail?: string
}, requestId: string) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    logger.error('User not authenticated during plan update', {
      requestId,
      error: authError?.message,
    });
    throw new Error("User not authenticated");
  }

  const updateObject = {
    paymentStatus,
    amount,
    planType,
    paid_at: new Date().toISOString(),
    email: customerEmail || user.email,
  };

  logger.debug('Updating user plan in database', {
    requestId,
    userId: user.id,
    planType,
    paymentStatus,
  });

  const { data, error } = await supabase
    .from("userTable")
    .update(updateObject)
    .eq('id', user.id)
    .select();

  if (error) {
    logger.error("Error updating plan in database", {
      requestId,
      userId: user.id,
      error: error.message,
    });
    throw new Error(`Failed to update plan: ${error.message}`);
  }

  logger.info('Plan updated successfully', {
    requestId,
    userId: user.id,
    planType,
  });

  return data;
}