import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createPrompt } from "../prompt/createPrompt";
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

  type TuneData = {
    id: number | string;
    title: string;
    name: string;
    steps: null;
    trained_at: null;
    started_training_at: null;
    created_at: string;
    updated_at: string;
    expires_at: null;
  };

  try {
    const incomingData = (await request.json()) as { tune: TuneData };
    const { tune } = incomingData;

    const urlObj = new URL(request.url);
    const user_id = urlObj.searchParams.get("user_id");
    const webhook_secret = urlObj.searchParams.get("webhook_secret");

    logger.info('Tune webhook received', {
      requestId,
      userId: user_id || undefined,
      tuneId: tune?.id,
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
      return NextResponse.json(
        { message: "Unauthorized!" },
        { status: 401 }
      );
    }

    if (!user_id) {
      logger.warn('User ID missing', { requestId });
      return NextResponse.json(
        { message: "Malformed URL, no user_id detected!" },
        { status: 400 }
      );
    }

    const idempotencyKey = generateIdempotencyKey(user_id, tune.created_at);
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

    const { data: userData, error } = await supabase
      .from('userTable')
      .select('id, email, tuneStatus, workStatus, promptsResult, planType')
      .eq('id', user_id)
      .single();

    if (error) {
      logger.error("Error fetching user data", {
        requestId,
        userId: user_id,
        error: error.message,
      });
      return NextResponse.json(
        { message: "Error fetching user data" },
        { status: 500 }
      );
    }

    if (!userData) {
      logger.warn("User not found", { requestId, userId: user_id });
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    const result = await processWebhookWithRetry(
      { userData, user_id, tune },
      async (data) => {
        const { data: modelUpdated, error: modelUpdatedError } = await supabase
          .from("userTable")
          .update({ tuneStatus: "completed" })
          .eq("id", data.user_id)
          .select();

        if (modelUpdatedError) {
          throw new Error(`Failed to update model: ${modelUpdatedError.message}`);
        }

        logger.info("Model status updated", {
          requestId,
          userId: data.user_id,
          tuneId: data.tune.id,
        });

        const promptResults = await createPrompt([data.userData]);

        if ('error' in promptResults && promptResults.error) {
          throw new Error(`Failed to create prompts: ${promptResults.message}`);
        }

        return { modelUpdated, promptResults };
      },
      'Tune webhook processing'
    );

    const duration = Date.now() - startTime;

    if (result.success) {
      logger.info('Tune webhook processed successfully', {
        requestId,
        userId: user_id,
        duration,
      });

      return NextResponse.json(
        {
          message: `Webhook processed successfully`,
          userId: user_id,
        },
        { status: 200 }
      );
    } else {
      logger.error('Tune webhook processing failed after retries', {
        requestId,
        userId: user_id,
        error: result.error,
        duration,
      });

      return NextResponse.json(
        { message: "Failed to process webhook after retries" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.critical('Tune webhook exception', {
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