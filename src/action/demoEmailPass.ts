"use server"

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { AuthError } from "@supabase/supabase-js";
import { sendEmail } from "./sendEmail";
import { logger } from "@/lib/logger";

// Demo email patterns that can bypass normal verification
const DEMO_EMAIL_PATTERNS = [
  'demo@cvphoto.app',
  'test@cvphoto.app',
  'demo+',
  'test+',
];

// Demo user data template
const DEMO_USER_TEMPLATE = {
  name: 'Demo User',
  planType: 'basic',
  paymentStatus: 'paid',
  workStatus: 'completed',
  tuneStatus: 'completed',
  promptsResult: [
    {
      id: 'demo-prompt-1',
      status: 'completed',
      url: 'https://cdn.cvphoto.app/demo/demo-headshot-1.jpg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'demo-prompt-2',
      status: 'completed', 
      url: 'https://cdn.cvphoto.app/demo/demo-headshot-2.jpg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ],
  userPhotos: {
    userSelfies: [
      'https://cdn.cvphoto.app/demo/demo-selfie-1.jpg',
      'https://cdn.cvphoto.app/demo/demo-selfie-2.jpg',
    ]
  },
  apiStatus: {
    id: 'demo-tune-123',
    title: 'demo-user',
    name: 'Demo',
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  submissionDate: new Date().toISOString(),
  regenerationCount: 0,
};

function isDemoEmail(email: string): boolean {
  return DEMO_EMAIL_PATTERNS.some(pattern => {
    if (pattern.endsWith('+')) {
      return email.startsWith(pattern.slice(0, -1));
    }
    return email === pattern;
  });
}

async function sendDemoWelcomeEmail(email: string) {
  return await sendEmail({
    to: email,
    from: process.env.NOREPLY_EMAIL || 'noreply@cvphoto.app',
    templateId: 'd-demo-welcome-template', // Demo-specific template
  });
}

export async function demoSignUp(formData: FormData): Promise<never> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  
  // Check if this is a demo email
  if (!isDemoEmail(email)) {
    return redirect(`/demo-signup?message=${encodeURIComponent('Only demo emails are allowed for this signup method')}`);
  }

  const supabase = createClient();

  try {
    // Sign up the demo user
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      }
    });

    if (error) {
      let errorMessage = "An error occurred during demo signup.";
      if (error instanceof AuthError) {
        switch (error.status) {
          case 400:
            errorMessage = "Invalid email or password format.";
            break;
          case 422:
            errorMessage = "Email already in use.";
            break;
          default:
            errorMessage = error.message;
        }
      }
      return redirect(`/demo-signup?message=${encodeURIComponent(errorMessage)}`);
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      return redirect(`/demo-signup?message=${encodeURIComponent('Failed to create demo user')}`);
    }

    // Create demo user data with pre-filled content
    const demoUserData = {
      ...DEMO_USER_TEMPLATE,
      id: userId,
      email,
    };

    const { error: updateError } = await supabase
      .from("userTable")
      .upsert(demoUserData)
      .select();

    if (updateError) {
      logger.error("Error updating demo user data:", {
        userId,
        error: updateError.message,
      });
    }

    // Send demo welcome email
    await sendDemoWelcomeEmail(email);

    logger.info("Demo user created successfully", {
      userId,
      email,
    });

    return redirect("/demo-dashboard?demoSetupCompleted");
  } catch (error: any) {
    logger.error("Demo signup error", {
      email,
      error: error.message,
      stack: error.stack,
    });
    
    return redirect(`/demo-signup?message=${encodeURIComponent('An error occurred during demo signup')}`);
  }
}

export async function isDemoUser(userId: string): Promise<boolean> {
  const supabase = createClient();
  
  try {
    const { data: userData, error } = await supabase
      .from('userTable')
      .select('email')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      return false;
    }

    return isDemoEmail(userData.email);
  } catch (error) {
    logger.error("Error checking demo user status", {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

export async function getDemoUserData(userId: string): Promise<any | null> {
  const supabase = createClient();
  
  try {
    const { data: userData, error } = await supabase
      .from('userTable')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      return null;
    }

    // Check if this is a demo user by looking for demo patterns in the data
    const hasDemoData = userData.promptsResult?.some((prompt: any) => 
      prompt.id?.startsWith('demo-prompt-')
    );

    return hasDemoData ? userData : null;
  } catch (error) {
    logger.error("Error getting demo user data", {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}