import Stripe from 'stripe';
import { logger } from './logger';
import { withRetry, withTimeout } from './apiHelpers';

export class StripeHelper {
  private stripe: Stripe;
  private maxRetries: number;
  private retryDelay: number;
  private timeoutMs: number;

  constructor(apiKey: string, config?: {
    maxRetries?: number;
    retryDelay?: number;
    timeoutMs?: number;
  }) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-06-20',
    });
    this.maxRetries = config?.maxRetries || 3;
    this.retryDelay = config?.retryDelay || 1000;
    this.timeoutMs = config?.timeoutMs || 30000;
  }

  private async withStripeRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    return withRetry(
      async () => {
        return await withTimeout(
          operation(),
          this.timeoutMs,
          `${context} timeout after ${this.timeoutMs}ms`
        );
      },
      this.maxRetries,
      this.retryDelay,
      context
    );
  }

  async retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.withStripeRetry(
        () => this.stripe.checkout.sessions.retrieve(sessionId),
        `Retrieve session ${sessionId}`
      );
      
      logger.info('Stripe session retrieved successfully', {
        sessionId,
        status: session.payment_status,
      });
      
      return session;
    } catch (error: any) {
      logger.error('Failed to retrieve Stripe session', {
        sessionId,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to retrieve session: ${error.message}`);
    }
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    customerEmail: string,
    metadata: Record<string, string> = {}
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.withStripeRetry(
        () => this.stripe.paymentIntents.create({
          amount,
          currency,
          customer_email: customerEmail,
          metadata,
          automatic_payment_methods: {
            enabled: true,
          },
        }),
        'Create payment intent'
      );

      logger.info('Payment intent created successfully', {
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        customerEmail,
      });

      return paymentIntent;
    } catch (error: any) {
      logger.error('Failed to create payment intent', {
        amount,
        currency,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  async confirmPayment(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.withStripeRetry(
        () => this.stripe.paymentIntents.confirm(paymentIntentId, {
          payment_method: paymentMethodId,
        }),
        `Confirm payment ${paymentIntentId}`
      );

      logger.info('Payment confirmed successfully', {
        paymentIntentId,
        status: paymentIntent.status,
      });

      return paymentIntent;
    } catch (error: any) {
      logger.error('Failed to confirm payment', {
        paymentIntentId,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to confirm payment: ${error.message}`);
    }
  }

  async handlePaymentError(error: any): Promise<{ 
    userMessage: string; 
    shouldRetry: boolean; 
    errorCode?: string;
  }> {
    let userMessage = 'Payment processing failed. Please try again.';
    let shouldRetry = true;
    let errorCode: string | undefined;

    if (error.type === 'StripeCardError') {
      // Card was declined
      userMessage = this.getCardErrorMessage(error.code);
      shouldRetry = error.code !== 'card_declined' && error.code !== 'expired_card';
      errorCode = error.code;
    } else if (error.type === 'StripeInvalidRequestError') {
      userMessage = 'Invalid payment request. Please check your information.';
      shouldRetry = false;
      errorCode = 'invalid_request';
    } else if (error.type === 'StripeAPIError') {
      userMessage = 'Payment service temporarily unavailable. Please try again later.';
      shouldRetry = true;
      errorCode = 'api_error';
    } else if (error.type === 'StripeConnectionError') {
      userMessage = 'Network error. Please check your connection and try again.';
      shouldRetry = true;
      errorCode = 'connection_error';
    } else if (error.message.includes('timeout')) {
      userMessage = 'Payment processing timed out. Please try again.';
      shouldRetry = true;
      errorCode = 'timeout';
    }

    logger.warn('Payment error handled', {
      errorType: error.type,
      errorCode: error.code,
      userMessage,
      shouldRetry,
    });

    return { userMessage, shouldRetry, errorCode };
  }

  private getCardErrorMessage(errorCode: string): string {
    const cardErrors: Record<string, string> = {
      'card_declined': 'Your card was declined. Please use a different card.',
      'expired_card': 'Your card has expired. Please use a different card.',
      'incorrect_cvc': 'The CVC code is incorrect. Please check and try again.',
      'incorrect_zip': 'The ZIP/postal code is incorrect. Please check and try again.',
      'card_not_supported': 'Your card is not supported. Please use a different card.',
      'processing_error': 'Payment processing error. Please try again or use a different card.',
      'insufficient_funds': 'Insufficient funds. Please use a different payment method.',
      'lost_card': 'This card has been reported lost. Please use a different card.',
      'stolen_card': 'This card has been reported stolen. Please use a different card.',
    };

    return cardErrors[errorCode] || 'Card payment failed. Please try again.';
  }

  async checkSessionStatus(sessionId: string): Promise<{
    isPaid: boolean;
    status: string;
    customerEmail?: string;
  }> {
    try {
      const session = await this.retrieveSession(sessionId);
      return {
        isPaid: session.payment_status === 'paid',
        status: session.payment_status,
        customerEmail: session.customer_details?.email,
      };
    } catch (error: any) {
      logger.error('Failed to check session status', {
        sessionId,
        error: error.message,
      });
      return {
        isPaid: false,
        status: 'error',
      };
    }
  }

  getRetryAfterHeader(error: any): number | null {
    if (error.headers && error.headers['Retry-After']) {
      const retryAfter = parseInt(error.headers['Retry-After'], 10);
      if (!isNaN(retryAfter)) {
        return retryAfter;
      }
    }
    return null;
  }

  async createCheckoutSession(
    priceId: string,
    customerEmail: string,
    successUrl: string,
    cancelUrl: string,
    metadata: Record<string, string> = {}
  ): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.withStripeRetry(
        () => this.stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price: priceId,
            quantity: 1,
          }],
          mode: 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: customerEmail,
          metadata,
        }),
        'Create checkout session'
      );

      logger.info('Checkout session created successfully', {
        sessionId: session.id,
        customerEmail,
      });

      return session;
    } catch (error: any) {
      logger.error('Failed to create checkout session', {
        priceId,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
  }
}