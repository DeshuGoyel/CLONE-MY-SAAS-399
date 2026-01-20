import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      storage: 'unknown',
    },
    version: process.env.npm_package_version || '1.0.0',
  };

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { error: dbError } = await supabase
        .from('userTable')
        .select('id')
        .limit(1);
      
      checks.services.database = dbError ? 'unhealthy' : 'healthy';
      
      const { error: storageError } = await supabase
        .storage
        .from('userphotos')
        .list('', { limit: 1 });
      
      checks.services.storage = storageError ? 'unhealthy' : 'healthy';
    }

    const isHealthy = Object.values(checks.services).every(s => s === 'healthy');
    checks.status = isHealthy ? 'healthy' : 'degraded';

    return NextResponse.json(checks, {
      status: isHealthy ? 200 : 503,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
