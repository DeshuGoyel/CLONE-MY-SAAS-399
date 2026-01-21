import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { validateWebhookSecret, processWebhookWithRetry, generateIdempotencyKey, checkIdempotency } from "@/lib/webhookHelpers";
import { generateRequestId } from "@/lib/apiHelpers";
import { WebhookValidator } from "@/lib/webhookValidator";
import { IdempotencyManager } from "@/lib/idempotencyManager";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appWebhookSecret = process.env.APP_WEBHOOK_SECRET;

if (!supabaseUrl) {
  throw new Error("MISSING NEXT_PUBLIC_SUPABASE_URL!");
}

if (!supabaseServiceRoleKey) {
  throw new Error("MISSING SUPABASE_SERVICE_ROLE_KEY!");
}

if (!appWebhookSecret) {
  throw new Error("MISSING APP_WEBHOOK_SECRET!");
}

const webhookValidator = new WebhookValidator();
const idempotencyManager = new IdempotencyManager();

// Initialize idempotency manager
idempotencyManager.initialize().catch((error) => {
  logger.error('Failed to initialize idempotency manager', {
    error: error.message,
  });
});

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  try {
    // Validate rate limits
    const urlObj = new URL(request.url);
    const user_id = urlObj.searchParams.get("user_id");
    const webhook_secret = urlObj.searchParams.get("webhook_secret");

    const rateLimitResult = await webhookValidator.checkRateLimit(
      user_id || 'anonymous',
      clientIp,
      'prompt-webhook'
    );
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', {
        requestId,
        userId: user_id || undefined,
        clientIp,
        remaining: rateLimitResult.remaining,
        resetTime: new Date(rateLimitResult.resetTime).toISOString(),
      });
      
      return NextResponse.json(
        { message: "Rate limit exceeded" },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          }
        }
      );
    }

    const incomingData = await request.json() as unknown;

    logger.info('Prompt webhook received', {
      requestId,
      userId: user_id || undefined,
      timestamp: new Date().toISOString(),
      clientIp,
    });

    if (!webhook_secret) {
      logger.warn('Webhook secret missing', { requestId, userId: user_id || undefined });
      return NextResponse.json(
        { message: "Malformed URL, no webhook_secret detected!" },
        { status: 400 }
      );
    }

    if (!webhookValidator.validateWebhookSecret(webhook_secret, appWebhookSecret as string)) {
      logger.error('Invalid webhook secret', { requestId, userId: user_id || undefined });
      return NextResponse.json({ message: "Unauthorized!" }, { status: 401 });
    }

    if (!user_id) {
      logger.warn('User ID missing', { requestId });
      return NextResponse.json(
        { message: "Malformed URL, no user_id detected!" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const idempotencyKey = idempotencyManager.generateIdempotencyKey(user_id, timestamp, 'prompt');
    const isDuplicate = await idempotencyManager.checkIdempotency(idempotencyKey);
    
    if (isDuplicate) {
      logger.info('Duplicate webhook detected, skipping', {
        requestId,
        userId: user_id,
        idempotencyKey,
      });
      return NextResponse.json(
        { message: "Webhook already processed" },
        { status: 200 }
      );
    }

    const supabase = createClient(
      supabaseUrl as string,
      supabaseServiceRoleKey as string,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    const { data: userData, error: userError } = await supabase
      .from('userTable')
      .select('id, email, workStatus, promptsResult, planType')
      .eq('id', user_id)
      .single();

    if (userError) {
      logger.error('Error fetching user from userTable', {
        requestId,
        userId: user_id,
        error: userError.message,
      });
      return NextResponse.json(
        { message: "Error fetching user data" },
        { status: 500 }
      );
    }

    if (!userData) {
      logger.warn('User not found in userTable', { requestId, userId: user_id });
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

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

    const result = await processWebhookWithRetry(
      { userData, user_id, incomingData, timestamp },
      async (data) => {
        const newPromptResult = { timestamp: data.timestamp, data: data.incomingData };
        const currentPromptsResult = Array.isArray(data.userData.promptsResult)
          ? data.userData.promptsResult
          : [];
        const updatedPromptsResult = [...currentPromptsResult, newPromptResult];

        const userPlanType = data.userData.planType || 'basic';
        const allowedPrompts = getAllowedPrompts(userPlanType);
        const currentPromptCount = updatedPromptsResult.length;

        logger.debug('Processing prompt webhook', {
          requestId,
          userId: data.user_id,
          planType: userPlanType,
          allowedPrompts,
          currentPromptCount,
        });

        if (currentPromptCount > allowedPrompts) {
          throw new Error('Prompt limit exceeded for plan');
        }

        const updateObject: { promptsResult: any[]; workStatus?: string } = {
          promptsResult: updatedPromptsResult
        };

        if (data.userData.workStatus === 'ongoing') {
          updateObject.workStatus = 'complete';
        }

        const { error: userUpdatedError } = await supabase
          .from('userTable')
          .update(updateObject)
          .eq('id', data.user_id);

        if (userUpdatedError) {
          throw new Error(`Failed to update user: ${userUpdatedError.message}`);
        }

        return { promptCount: currentPromptCount, allowedPrompts };
      },
      'Prompt webhook processing'
    );

    const duration = Date.now() - startTime;

    if (result.success) {
      logger.info('Prompt webhook processed successfully', {
        requestId,
        userId: user_id,
        duration,
        clientIp,
      });

      // Mark as processed in idempotency manager
      await idempotencyManager.markProcessed(idempotencyKey);

      // Log successful webhook processing
      await webhookValidator.logWebhookRequest(request, user_id, true);

      return NextResponse.json(
        {
          message: "Webhook processed successfully",
          userId: user_id,
          requestId,
        },
        {
          status: 200,
          headers: {
            'X-Request-ID': requestId,
            'X-Processing-Time': duration.toString(),
          }
        }
      );
    } else {
      logger.error('Prompt webhook processing failed after retries', {
        requestId,
        userId: user_id,
        error: result.error,
        duration,
        clientIp,
      });

      // Log failed webhook processing
      await webhookValidator.logWebhookRequest(request, user_id, false, result.error);

      return NextResponse.json(
        {
          message: result.error || "Failed to process webhook",
          error: result.error,
          requestId
        },
        {
          status: 500,
          headers: {
            'X-Request-ID': requestId,
          }
        }
      );
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.critical('Prompt webhook exception', {
      requestId,
      error: error.message,
      stack: error.stack,
      duration,
      clientIp,
    });

    // Log failed webhook processing
    webhookValidator.logWebhookRequest(request, user_id || null, false, error.message).catch((logError) => {
      logger.error('Failed to log webhook error', {
        requestId,
        error: logError.message,
      });
    });

    return NextResponse.json(
      { 
        message: "Internal server error",
        error: error.message,
        requestId
      },
      { 
        status: 500,
        headers: {
          'X-Request-ID': requestId,
        }
      }
    );
  }
}

// Example of userData field promptsResult
// {
//   "2024-09-29T16:16:07.635Z": {
//     "prompt": {
//       "id": 18609859,
//       "text": "<lora:1661944:1.0>ohwx man in the style of communist",
//       "steps": null,
//       "images": [
//         "https://sdbooth2-production.s3.amazonaws.com/sb806vy5dbscmkmy649106cum8eb",
//         "https://sdbooth2-production.s3.amazonaws.com/982c8f6fb6m005bjidz3hiv1k8k1",
//         "https://sdbooth2-production.s3.amazonaws.com/cga5sxuexi7ykiozybj5iltwkeg1",
//         "https://sdbooth2-production.s3.amazonaws.com/1ukl6poc8zcnj8l0j2u5sfse7mfz"
//       ],
//       "tune_id": 1504944,
//       "created_at": "2024-09-29T16:00:43.046Z",
//       "trained_at": "2024-09-29T16:16:06.539Z",
//       "updated_at": "2024-09-29T16:16:06.677Z",
//       "negative_prompt": "",
//       "started_training_at": "2024-09-29T16:13:55.014Z"
//     }
//   }
// }