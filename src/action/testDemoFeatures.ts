"use server"

import { getTaskStatus } from './getTaskStatus';
import { isDemoUser, getDemoUserData, demoSignUp } from './demoEmailPass';
import { createClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';

export async function testDemoFeatures() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: 'No authenticated user found',
    };
  }

  try {
    // Test task status functionality
    const tasks = await getTaskStatus(user.id);
    logger.info('Task status test completed', {
      userId: user.id,
      taskCount: tasks.length,
    });

    // Test demo user detection
    const isDemo = await isDemoUser(user.id);
    logger.info('Demo user detection test completed', {
      userId: user.id,
      isDemo,
    });

    // Test demo user data retrieval
    let demoData = null;
    if (isDemo) {
      demoData = await getDemoUserData(user.id);
      logger.info('Demo user data retrieval test completed', {
        userId: user.id,
        hasDemoData: !!demoData,
      });
    }

    return {
      success: true,
      userId: user.id,
      email: user.email,
      isDemoUser: isDemo,
      demoData: demoData ? 'Demo data found' : null,
      taskCount: tasks.length,
      tasks: tasks.map(task => ({
        taskId: task.taskId,
        status: task.status,
        hasPreview: !!task.previewUrl,
      })),
    };
  } catch (error: any) {
    logger.error('Demo features test error', {
      userId: user.id,
      error: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      message: 'Error testing demo features',
      error: error.message,
    };
  }
}

export async function testDemoEmailValidation(email: string) {
  try {
    // This would normally use the validation schema, but for testing we'll check the pattern
    const demoPatterns = ['demo@cvphoto.app', 'test@cvphoto.app'];
    const demoPrefixPatterns = ['demo+', 'test+'];

    // Check exact matches
    if (demoPatterns.includes(email)) {
      return { valid: true, message: 'Valid demo email (exact match)' };
    }

    // Check prefix patterns
    const isValidPrefix = demoPrefixPatterns.some(prefix => email.startsWith(prefix));
    if (isValidPrefix) {
      return { valid: true, message: 'Valid demo email (prefix match)' };
    }

    return { valid: false, message: 'Not a valid demo email pattern' };
  } catch (error: any) {
    return { valid: false, message: 'Error validating demo email', error: error.message };
  }
}