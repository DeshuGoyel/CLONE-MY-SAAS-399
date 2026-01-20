import Header from "@/components/Header";
import getUser from "@/action/getUser";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Analytics Dashboard | AI Headshot Generator",
  description: "View your AI headshot generation analytics and usage statistics.",
};

export default async function AnalyticsPage() {
  const userData = await getUser();

  if (!userData || userData.length === 0) {
    redirect("/");
  }

  const user = userData[0];

  const promptsResult = Array.isArray(user.promptsResult) ? user.promptsResult : [];
  const downloadHistory = Array.isArray(user.downloadHistory) ? user.downloadHistory : [];

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

  const planType = user.planType || 'basic';
  const allowedPrompts = getAllowedPrompts(planType);
  const usedPrompts = promptsResult.length;
  const remainingPrompts = allowedPrompts - usedPrompts;

  const totalImages = promptsResult.reduce((acc: number, result: any) => {
    const images = result.data?.prompt?.images || [];
    return acc + images.length;
  }, 0);

  const usagePercentage = Math.round((usedPrompts / allowedPrompts) * 100);

  return (
    <main className="min-h-screen bg-mainWhite">
      <Header userAuth={true} />

      <section className="max-w-6xl mx-auto mt-12 p-5">
        <div className="mb-6">
          <Link 
            href="/dashboard" 
            className="text-sm text-gray-600 hover:text-mainBlack mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-mainBlack mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600">
            Track your AI headshot generation usage and statistics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Images Generated</h3>
            <p className="text-3xl font-bold text-mainBlack">{totalImages}</p>
            <p className="text-xs text-gray-500 mt-1">{planType.charAt(0).toUpperCase() + planType.slice(1)} Plan</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Credits Used</h3>
            <p className="text-3xl font-bold text-mainBlack">{usedPrompts} / {allowedPrompts}</p>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-mainOrange h-2 rounded-full transition-all"
                style={{ width: `${usagePercentage}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Downloads</h3>
            <p className="text-3xl font-bold text-mainBlack">{downloadHistory.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total image downloads</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-8">
          <h2 className="text-xl font-semibold text-mainBlack mb-4">Generation Timeline</h2>
          <div className="space-y-3">
            {promptsResult.length > 0 ? (
              promptsResult.map((result: any, index: number) => {
                const imageCount = result.data?.prompt?.images?.length || 0;
                const timestamp = new Date(result.timestamp).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div 
                    key={index} 
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                  >
                    <div>
                      <p className="font-medium text-mainBlack">Generation #{index + 1}</p>
                      <p className="text-sm text-gray-600">{timestamp}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-mainBlack">{imageCount} images</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 text-center py-8">No generations yet</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-xl font-semibold text-mainBlack mb-4">Plan Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Current Plan</p>
              <p className="font-semibold text-mainBlack capitalize">{planType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Remaining Credits</p>
              <p className="font-semibold text-mainBlack">{remainingPrompts}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Account Created</p>
              <p className="font-semibold text-mainBlack">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Status</p>
              <p className="font-semibold text-mainBlack capitalize">{user.paymentStatus}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
