"use client";

import Header from "@/components/Header";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReferralsPage() {
  const [referralData, setReferralData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const response = await fetch('/api/referral');
      if (response.ok) {
        const data = await response.json();
        setReferralData(data);
      } else {
        console.error('Failed to fetch referral data');
      }
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (referralData?.referralCode) {
      const link = `${window.location.origin}?ref=${referralData.referralCode}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyReferralCode = () => {
    if (referralData?.referralCode) {
      navigator.clipboard.writeText(referralData.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-mainWhite">
        <Header userAuth={true} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  const referrals = referralData?.referrals || [];
  const totalRewards = referralData?.totalRewards || 0;

  return (
    <main className="min-h-screen bg-mainWhite">
      <Header userAuth={true} />

      <section className="max-w-4xl mx-auto mt-12 p-5">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-600 hover:text-mainBlack mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-mainBlack mb-2">
            Referral Program
          </h1>
          <p className="text-gray-600">
            Invite friends and earn rewards for every successful referral
          </p>
        </div>

        <div className="bg-gradient-to-r from-mainOrange to-mainGreen p-8 rounded-lg mb-8 text-mainBlack">
          <h2 className="text-2xl font-bold mb-4">Your Referral Code</h2>
          <div className="bg-white/90 backdrop-blur rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Your unique code:</p>
                <p className="text-3xl font-bold tracking-wider">
                  {referralData?.referralCode || 'LOADING...'}
                </p>
              </div>
              <button
                onClick={copyReferralCode}
                className="px-4 py-2 bg-mainBlack text-white rounded-md hover:bg-mainBlack/90 transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy Code'}
              </button>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-600 mb-2">Share this link:</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${referralData?.referralCode || ''}`}
                  className="flex-1 px-3 py-2 bg-gray-100 rounded-md text-sm"
                />
                <button
                  onClick={copyReferralLink}
                  className="px-4 py-2 bg-mainBlack text-white rounded-md hover:bg-mainBlack/90 transition-colors whitespace-nowrap"
                >
                  {copied ? '✓ Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Referrals</h3>
            <p className="text-3xl font-bold text-mainBlack">{referrals.length}</p>
            <p className="text-xs text-gray-500 mt-1">Friends who signed up</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Rewards</h3>
            <p className="text-3xl font-bold text-mainBlack">${totalRewards}</p>
            <p className="text-xs text-gray-500 mt-1">In referral credits</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-xl font-semibold text-mainBlack mb-4">Referral History</h2>
          {referrals.length > 0 ? (
            <div className="space-y-3">
              {referrals.map((referral: any, index: number) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-4 bg-gray-50 rounded-md"
                >
                  <div>
                    <p className="font-medium text-mainBlack">
                      {referral.email || 'User'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(referral.signupDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        referral.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {referral.status || 'Pending'}
                    </span>
                    <p className="text-sm text-gray-600 mt-1">+$5</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-2">No referrals yet</p>
              <p className="text-sm text-gray-400">
                Share your referral code to start earning rewards!
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-mainBlack mb-2">How it works</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Share your unique referral code or link with friends</li>
            <li>• They sign up and make their first purchase</li>
            <li>• You earn $5 credit for each successful referral</li>
            <li>• Credits can be used towards future AI headshot generations</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
