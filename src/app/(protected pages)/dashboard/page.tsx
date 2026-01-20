import Header from "@/components/Header";
import Link from "next/link";
import getUser from "@/action/getUser";
import { redirect } from "next/navigation";
import { CheckCircle } from "lucide-react"; // Add this import at the top of the file

export const metadata = {
  title: "Your Dashboard | AI Headshot Generator",
  description:
    "Manage your AI-generated headshots, account settings, and subscription plan.",
};

export default async function DashboardPage() {
  const userData = await getUser();

  if (!userData || userData.length === 0) {
    // Handle the case when no user data is found
    redirect("/");
  }

  const user = userData[0];

  if (
    !user.workStatus ||
    user.workStatus === "" ||
    user.workStatus === "NULL"
  ) {
    redirect("/upload/intro");
  } else if (user.workStatus === "ongoing") {
    redirect("/wait");
  }

  //console.log("userData here:", userData);

  return (
    <main className="min-h-screen bg-mainWhite">
      <Header userAuth={true} />

      <section className="max-w-4xl mx-auto mt-12 p-5">
        <h1 className="text-3xl font-bold text-mainBlack mb-3 text-center">
          Your Headshots Are Ready!
        </h1>
        <p className="text-sm text-gray-600 mb-8 text-center">
          Click below to view your results. Remember, they&apos;ll be
          automatically deleted after 30 days.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link href="/dashboard/results" className="block">
            <article className="p-6 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-center mb-4">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <p className="text-sm font-medium text-gray-700">
                  Your photos are ready
                </p>
              </div>
              <div
                className="w-full text-center px-6 py-3 text-sm font-medium rounded-md transition-colors text-mainBlack bg-gray-100 hover:bg-gray-200"
                aria-label="View Your Headshot Results"
              >
                View Your Results →
              </div>
            </article>
          </Link>

          <Link href="/dashboard/analytics" className="block">
            <article className="p-6 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm font-medium text-gray-700">
                  View analytics
                </p>
              </div>
              <div
                className="w-full text-center px-6 py-3 text-sm font-medium rounded-md transition-colors text-mainBlack bg-gray-100 hover:bg-gray-200"
              >
                Analytics Dashboard →
              </div>
            </article>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/dashboard/referrals" className="block">
            <article className="p-6 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-purple-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm font-medium text-gray-700">
                  Referral program
                </p>
              </div>
              <div
                className="w-full text-center px-6 py-3 text-sm font-medium rounded-md transition-colors text-mainBlack bg-gray-100 hover:bg-gray-200"
              >
                Earn Rewards →
              </div>
            </article>
          </Link>

          <article className="p-6 rounded-lg border border-gray-200 bg-gray-50 cursor-not-allowed h-full opacity-60">
            <div className="flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-sm font-medium text-gray-500">
                Regenerate images
              </p>
            </div>
            <div
              className="w-full text-center px-6 py-3 text-sm font-medium rounded-md text-gray-500 bg-gray-200"
            >
              Coming Soon
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
