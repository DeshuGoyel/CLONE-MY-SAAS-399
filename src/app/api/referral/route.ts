import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';
import { generateReferralCode } from '@/lib/referral';
import { generateRequestId } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error } = await supabase
      .from('userTable')
      .select('referralCode, referrals, referralRewards')
      .eq('id', user.id)
      .single();

    if (error) {
      logger.error('Error fetching referral data', {
        requestId,
        userId: user.id,
        error: error.message,
      });
      return NextResponse.json(
        { error: 'Failed to fetch referral data' },
        { status: 500 }
      );
    }

    let referralCode = userData?.referralCode;

    if (!referralCode) {
      referralCode = generateReferralCode();
      const { error: updateError } = await supabase
        .from('userTable')
        .update({ referralCode })
        .eq('id', user.id);

      if (updateError) {
        logger.error('Failed to create referral code', {
          requestId,
          userId: user.id,
          error: updateError.message,
        });
      }
    }

    return NextResponse.json({
      referralCode,
      referrals: userData?.referrals || [],
      totalRewards: userData?.referralRewards || 0,
    });
  } catch (error: any) {
    logger.error('Referral endpoint error', {
      requestId,
      error: error.message,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const requestId = generateRequestId();

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { referredCode } = body;

    if (!referredCode || typeof referredCode !== 'string') {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    const { data: referrerData, error: referrerError } = await supabase
      .from('userTable')
      .select('id, referrals, referralRewards')
      .eq('referralCode', referredCode.toUpperCase())
      .single();

    if (referrerError || !referrerData) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    if (referrerData.id === user.id) {
      return NextResponse.json(
        { error: 'Cannot use your own referral code' },
        { status: 400 }
      );
    }

    const referrals = Array.isArray(referrerData.referrals) 
      ? referrerData.referrals 
      : [];

    const newReferral = {
      userId: user.id,
      email: user.email,
      signupDate: new Date().toISOString(),
      status: 'pending',
    };

    const { error: updateError } = await supabase
      .from('userTable')
      .update({
        referrals: [...referrals, newReferral],
        referralRewards: (referrerData.referralRewards || 0) + 5,
      })
      .eq('id', referrerData.id);

    if (updateError) {
      logger.error('Failed to update referral', {
        requestId,
        referrerId: referrerData.id,
        error: updateError.message,
      });
      return NextResponse.json(
        { error: 'Failed to process referral' },
        { status: 500 }
      );
    }

    logger.info('Referral processed', {
      requestId,
      referrerId: referrerData.id,
      referredUserId: user.id,
    });

    return NextResponse.json({
      message: 'Referral applied successfully',
      reward: 5,
    });
  } catch (error: any) {
    logger.error('Referral POST error', {
      requestId,
      error: error.message,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
