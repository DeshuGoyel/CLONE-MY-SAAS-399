import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { validateWebhookSecret, processWebhookWithRetry, generateIdempotencyKey, checkIdempotency } from "@/lib/webhookHelpers";
import { generateRequestId } from "@/lib/apiHelpers";

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

const processedWebhooks = new Set<string>();

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const incomingData = await request.json() as unknown;

    const urlObj = new URL(request.url);
    const user_id = urlObj.searchParams.get("user_id");
    const webhook_secret = urlObj.searchParams.get("webhook_secret");

    logger.info('Prompt webhook received', {
      requestId,
      userId: user_id || undefined,
      timestamp: new Date().toISOString(),
    });

    if (!webhook_secret) {
      logger.warn('Webhook secret missing', { requestId, userId: user_id || undefined });
      return NextResponse.json(
        { message: "Malformed URL, no webhook_secret detected!" },
        { status: 400 }
      );
    }

    if (!validateWebhookSecret(webhook_secret, appWebhookSecret as string)) {
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
    const idempotencyKey = generateIdempotencyKey(user_id, timestamp);
    if (checkIdempotency(processedWebhooks, idempotencyKey)) {
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
      });

      return NextResponse.json(
        {
          message: "Webhook processed successfully",
          userId: user_id,
        },
        { status: 200 }
      );
    } else {
      logger.error('Prompt webhook processing failed after retries', {
        requestId,
        userId: user_id,
        error: result.error,
        duration,
      });

      return NextResponse.json(
        { message: result.error || "Failed to process webhook" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.critical('Prompt webhook exception', {
      requestId,
      error: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
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