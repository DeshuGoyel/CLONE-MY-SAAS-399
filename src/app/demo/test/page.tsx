import { testDemoFeatures, testDemoEmailValidation } from '@/action/testDemoFeatures';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DemoTestPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const testResults = await testDemoFeatures();
  
  // Test some demo email patterns
  const emailTests = [
    'demo@cvphoto.app',
    'test@cvphoto.app', 
    'demo+test@cvphoto.app',
    'test+user@cvphoto.app',
    'regular@cvphoto.app',
    'user@gmail.com'
  ];

  const emailValidationResults = await Promise.all(
    emailTests.map(async (email) => {
      const result = await testDemoEmailValidation(email);
      return { email, ...result };
    })
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">Demo Features Test</h1>
                <p className="mt-2 text-indigo-100">Comprehensive testing of task status preview and email pass functionality</p>
              </div>
              <div className="flex items-center space-x-4">
                <Link href="/demo" className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors">
                  Back to Demo
                </Link>
                <Link href="/dashboard" className="bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-600 transition-colors">
                  Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Test Results Summary */}
            <div className="bg-gray-50 rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Test Results Summary</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-medium text-gray-900 mb-2">📋 Overall Status</h3>
                  <p className={`text-sm font-medium ${testResults.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResults.success ? '✅ All tests passed' : '❌ Some tests failed'}
                  </p>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-medium text-gray-900 mb-2">👤 User Info</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="font-medium">ID:</span> {testResults.userId}</p>
                    <p><span className="font-medium">Email:</span> {testResults.email}</p>
                    <p><span className="font-medium">Demo User:</span> {testResults.isDemoUser ? '✅ Yes' : '❌ No'}</p>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-medium text-gray-900 mb-2">📊 Task Status</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="font-medium">Total Tasks:</span> {testResults.taskCount}</p>
                    <p><span className="font-medium">With Previews:</span> {(testResults.tasks || []).filter(t => t.hasPreview).length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Task Status Details */}
            <div className="bg-gray-50 rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Task Status Details</h2>
              
              {(testResults.tasks || []).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No tasks found for this user</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preview Available</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(testResults.tasks || []).map((task, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.taskId}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              task.status === 'completed' ? 'bg-green-100 text-green-800' :
                              task.status === 'ongoing' ? 'bg-yellow-100 text-yellow-800' :
                              task.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {task.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.hasPreview ? '✅ Yes' : '❌ No'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Email Validation Tests */}
            <div className="bg-gray-50 rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Email Validation Tests</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {emailValidationResults.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{result.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            result.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {result.valid ? '✅ Valid' : '❌ Invalid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{result.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">📋 Valid Demo Email Patterns</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• demo@cvphoto.app</li>
                  <li>• test@cvphoto.app</li>
                  <li>• demo+*@cvphoto.app (e.g., demo+test@cvphoto.app)</li>
                  <li>• test+*@cvphoto.app (e.g., test+user@cvphoto.app)</li>
                </ul>
              </div>
            </div>

            {/* Feature Documentation */}
            <div className="bg-indigo-50 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-indigo-800 mb-4">Implemented Features</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-medium text-gray-900 mb-2">🎯 Task Status Preview System</h3>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• Real-time task status tracking</li>
                    <li>• Visual progress indicators</li>
                    <li>• Preview image generation</li>
                    <li>• Multiple task type support (tune, prompt, workflow)</li>
                    <li>• Error handling and status messages</li>
                  </ul>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-medium text-gray-900 mb-2">📧 Demo Email Pass</h3>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• Pattern-based demo email detection</li>
                    <li>• Instant demo account creation</li>
                    <li>• Pre-loaded demo content</li>
                    <li>• Demo user detection API</li>
                    <li>• Demo-specific welcome emails</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium text-gray-900 mb-2">🔧 API Endpoints</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">GET /api/task/status</code> - Get task status with previews</li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">GET /api/demo/status</code> - Check demo user status</li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">POST /api/demo/validate</code> - Validate demo email patterns</li>
                </ul>
              </div>

              <div className="mt-6 bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium text-gray-900 mb-2">📁 Key Files Created</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">src/action/getTaskStatus.ts</code></li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">src/action/demoEmailPass.ts</code></li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">src/action/testDemoFeatures.ts</code></li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">src/app/api/task/status/route.ts</code></li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">src/app/api/demo/status/route.ts</code></li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">src/app/api/demo/validate/route.ts</code></li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">src/app/demo/page.tsx</code></li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">src/app/demo/test/page.tsx</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}