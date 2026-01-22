"use server"

import { createClient } from "@/utils/supabase/server";
import { logger } from "@/lib/logger";
import { generateOptimizedImageUrl, getImageOptimizationPresets } from "@/lib/imageOptimization";

export interface TaskStatus {
  taskId: string;
  status: 'pending' | 'ongoing' | 'completed' | 'failed' | 'unknown';
  createdAt?: string;
  updatedAt?: string;
  completionPercentage?: number;
  previewUrl?: string;
  fullUrl?: string;
  errorMessage?: string;
  eta?: string;
}

export async function getTaskStatus(userId: string): Promise<TaskStatus[]> {
  const supabase = createClient();
  
  try {
    // Get user data with task status information
    const { data: userData, error } = await supabase
      .from('userTable')
      .select('id, apiStatus, tuneStatus, workStatus, promptsResult, userPhotos')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      logger.error('Error fetching user task data', {
        userId,
        error: error?.message,
      });
      return [];
    }

    const tasks: TaskStatus[] = [];
    
    // Check if there's an active tune task (image generation)
    if (userData.apiStatus) {
      const tuneTask = createTuneTaskStatus(userData);
      tasks.push(tuneTask);
    }

    // Check prompt generation tasks
    if (userData.promptsResult) {
      const promptTasks = createPromptTasksStatus(userData);
      tasks.push(...promptTasks);
    }

    // Check overall work status
    const workStatusTask = createWorkStatusTask(userData);
    tasks.push(workStatusTask);

    return tasks.filter(task => task.status !== 'unknown');
  } catch (error: any) {
    logger.error('Error getting task status', {
      userId,
      error: error.message,
      stack: error.stack,
    });
    return [];
  }
}

function createTuneTaskStatus(userData: any): TaskStatus {
  const apiStatus = userData.apiStatus;
  const tuneStatus = userData.tuneStatus;
  const userPhotos = userData.userPhotos;
  
  // Determine status based on available data
  let status: TaskStatus['status'] = 'unknown';
  let completionPercentage = 0;
  let errorMessage: string | undefined;
  
  if (tuneStatus === 'completed') {
    status = 'completed';
    completionPercentage = 100;
  } else if (tuneStatus === 'ongoing' || apiStatus?.status === 'ongoing') {
    status = 'ongoing';
    // Estimate completion based on created_at and current time
    if (apiStatus?.created_at) {
      const createdDate = new Date(apiStatus.created_at);
      const now = new Date();
      const duration = now.getTime() - createdDate.getTime();
      // Typical tune takes about 5-10 minutes, estimate 30%
      completionPercentage = Math.min(30, duration / (60 * 1000));
    }
  } else if (apiStatus?.error || apiStatus?.status === 'failed') {
    status = 'failed';
    errorMessage = apiStatus.error || 'Tune task failed';
  } else if (apiStatus) {
    status = 'pending';
  }

  // Generate preview URL if completed and we have user photos
  let previewUrl: string | undefined;
  let fullUrl: string | undefined;
  
  if (status === 'completed' && userPhotos?.userSelfies?.[0]) {
    const previewPreset = getImageOptimizationPresets().preview;
    previewUrl = generateOptimizedImageUrl({
      baseUrl: userPhotos.userSelfies[0],
      ...previewPreset,
    });
    
    const fullPreset = getImageOptimizationPresets().full;
    fullUrl = generateOptimizedImageUrl({
      baseUrl: userPhotos.userSelfies[0],
      ...fullPreset,
    });
  }

  return {
    taskId: `tune-${userData.id}`,
    status,
    createdAt: apiStatus?.created_at,
    updatedAt: apiStatus?.updated_at,
    completionPercentage,
    previewUrl,
    fullUrl,
    errorMessage,
    eta: apiStatus?.eta,
  };
}

function createPromptTasksStatus(userData: any): TaskStatus[] {
  const promptsResult = userData.promptsResult;
  const tasks: TaskStatus[] = [];
  
  if (!promptsResult || !Array.isArray(promptsResult)) {
    return tasks;
  }

  promptsResult.forEach((prompt: any, index: number) => {
    let status: TaskStatus['status'] = 'unknown';
    let completionPercentage = 0;
    let errorMessage: string | undefined;
    let previewUrl: string | undefined;
    let fullUrl: string | undefined;

    if (prompt.status === 'completed' || prompt.url) {
      status = 'completed';
      completionPercentage = 100;
      
      // Generate preview URL if we have a result URL
      if (prompt.url) {
        const previewPreset = getImageOptimizationPresets().preview;
        previewUrl = generateOptimizedImageUrl({
          baseUrl: prompt.url,
          ...previewPreset,
        });
        
        const fullPreset = getImageOptimizationPresets().full;
        fullUrl = generateOptimizedImageUrl({
          baseUrl: prompt.url,
          ...fullPreset,
        });
      }
    } else if (prompt.status === 'processing' || prompt.status === 'queued') {
      status = 'ongoing';
      completionPercentage = 50; // Estimate for prompt generation
    } else if (prompt.error) {
      status = 'failed';
      errorMessage = prompt.error;
    } else {
      status = 'pending';
    }

    tasks.push({
      taskId: `prompt-${userData.id}-${index}`,
      status,
      createdAt: prompt.created_at,
      updatedAt: prompt.updated_at,
      completionPercentage,
      previewUrl,
      fullUrl,
      errorMessage,
    });
  });

  return tasks;
}

function createWorkStatusTask(userData: any): TaskStatus {
  const workStatus = userData.workStatus;
  
  let status: TaskStatus['status'] = 'unknown';
  let completionPercentage = 0;
  
  switch (workStatus) {
    case 'completed':
      status = 'completed';
      completionPercentage = 100;
      break;
    case 'processing':
      status = 'ongoing';
      completionPercentage = 75;
      break;
    case 'pending':
      status = 'pending';
      completionPercentage = 0;
      break;
    case 'failed':
      status = 'failed';
      break;
    default:
      status = 'unknown';
  }

  return {
    taskId: `workflow-${userData.id}`,
    status,
    completionPercentage,
  };
}