// app/actions/verifyPayment.ts
'use server'
import { createClient } from "@/utils/supabase/server";
import Stripe from 'stripe';
import { withRetry, withTimeout } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';
import { generateRequestId } from '@/lib/apiHelpers';

const stripeKey = process.env.ENVIRONMENT === 'DEVELOPMENT' 
  ? process.env.STRIPE_TEST_SECRET_KEY! 
  : process.env.STRIPE_SECRET_KEY!;

const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-06-20',
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

    // Use retry and timeout for Stripe API calls
    const session = await withRetry(
      async () => {
        return await withTimeout(
          stripe.checkout.sessions.retrieve(sessionId),
          30000, // 30 second timeout
          'Stripe session retrieval timed out'
        );
      },
      3, // 3 retry attempts
      1000, // 1 second base delay
      'Stripe session retrieval'
    );

    logger.info('Stripe session retrieved successfully', { 
      requestId, 
      sessionId,
      paymentStatus: session.payment_status
    });

    // Extract planType from metadata
    const planType: string | undefined = session.metadata?.planType;
    const customerEmail = session.customer_details?.email;

    logger.debug('Payment details extracted', { 
      requestId,
      planType,
      customerEmail,
      amount: session.amount_total,
      currency: session.currency
    });

    if (session.payment_status === 'paid') { 
      // Update user's plan in the database with retry logic
      const updateResult = await withRetry(
        async () => {
          return await updatePlan({ 
            paymentStatus: session.payment_status, 
            amount: session.amount_total ?? 0,
            planType: planType ?? 'default',
            customerEmail: customerEmail || undefined
          });
        },
        3,
        1000,
        'Database update after payment'
      );

      logger.info('Payment processed and user updated', { 
        requestId,
        userId: updateResult?.[0]?.id,
        planType: updateResult?.[0]?.planType
      });
    } else {
      logger.warn('Payment not completed', { 
        requestId,
        sessionId,
        paymentStatus: session.payment_status
      });
    }

    const duration = Date.now() - startTime;
    logger.info('Payment verification completed', { 
      requestId,
      duration,
      success: session.payment_status === 'paid'
    });

    return { 
      success: session.payment_status === 'paid', 
      status: session.payment_status,
      details: {
        id: session.id,
        customer: session.customer,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
      },
      requestId
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Payment verification failed', { 
      requestId,
      sessionId,
      error: error.message,
      stack: error.stack,
      duration
    });

    // Provide user-friendly error messages
    let userErrorMessage = 'Payment verification failed';
    
    if (error.message.includes('timed out')) {
      userErrorMessage = 'Payment processing is taking longer than expected. Please try again.';
    } else if (error.message.includes('network')) {
      userErrorMessage = 'Network error occurred. Please check your connection and try again.';
    } else if (error.message.includes('authentication')) {
      userErrorMessage = 'Authentication failed. Please log in and try again.';
    }

    throw new Error(userErrorMessage);
  }
}

async function updatePlan({paymentStatus, amount, planType, customerEmail}: { paymentStatus: string, amount: number, planType: string, customerEmail?: string }) {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error("User not authenticated");
    }

    const updateObject: {
        paymentStatus: string;
        amount: number;
        planType: string;
        paid_at: string;
        email?: string;
    } = {
        paymentStatus,
        amount,
        planType,
        paid_at: new Date().toISOString()
    };

    // Only update email if it's different from current user email
    if (customerEmail && customerEmail !== user.email) {
        updateObject.email = customerEmail;
    }

    const { data, error } = await supabase
      .from("userTable")
      .update(updateObject)
      .eq('id', user.id)
      .select();

    if (error) {
        console.error("Error updating plan:", error);
        throw error;
    }

    return data;
}