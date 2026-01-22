import { getTaskStatus } from '@/action/getTaskStatus';
import { isDemoUser, getDemoUserData } from '@/action/demoEmailPass';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DemoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const isDemo = await isDemoUser(user.id);
  const demoData = isDemo ? await getDemoUserData(user.id) : null;
  const tasks = await getTaskStatus(user.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">CVPHOTO AI Demo</h1>
                <p className="mt-2 text-indigo-100">Task Status Preview & Email Pass Demo</p>
              </div>
              <div className="flex items-center space-x-4">
                {isDemo && (
                  <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-medium">
                    DEMO MODE
                  </span>
                )}
                <Link href="/dashboard" className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors">
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Demo User Info */}
              <div className="lg:col-span-1">
                <div className="bg-gray-50 rounded-xl p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">User Information</h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">User ID</p>
                      <p className="font-medium text-gray-900">{user.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Account Type</p>
                      <p className="font-medium text-gray-900">
                        {isDemo ? 'Demo Account' : 'Regular Account'}
                      </p>
                    </div>
                    {isDemo && demoData && (
                      <div>
                        <p className="text-sm text-gray-500">Demo Features</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Pre-loaded Images</span>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Instant Access</span>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">No Payment Required</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Task Status Preview */}
              <div className="lg:col-span-2">
                <div className="bg-gray-50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-800">Task Status Preview</h2>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
                    </span>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No tasks found</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {tasks.map((task) => (
                        <div key={task.taskId} className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  task.status === 'completed' ? 'bg-green-500' :
                                  task.status === 'ongoing' ? 'bg-yellow-500' :
                                  task.status === 'failed' ? 'bg-red-500' :
                                  'bg-gray-300'
                                }`}></div>
                                <h3 className="font-medium text-gray-900 capitalize">
                                  {task.taskId.replace(/-/g, ' ')}
                                </h3>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                  task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  task.status === 'ongoing' ? 'bg-yellow-100 text-yellow-800' :
                                  task.status === 'failed' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {task.status.toUpperCase()}
                                </span>
                              </div>

                              <div className="space-y-2 text-sm">
                                {task.createdAt && (
                                  <div className="flex items-center text-gray-600">
                                    <span className="w-20 text-gray-500">Created:</span>
                                    <span>{new Date(task.createdAt).toLocaleString()}</span>
                                  </div>
                                )}
                                {task.updatedAt && (
                                  <div className="flex items-center text-gray-600">
                                    <span className="w-20 text-gray-500">Updated:</span>
                                    <span>{new Date(task.updatedAt).toLocaleString()}</span>
                                  </div>
                                )}
                                {task.eta && (
                                  <div className="flex items-center text-gray-600">
                                    <span className="w-20 text-gray-500">ETA:</span>
                                    <span>{new Date(task.eta).toLocaleString()}</span>
                                  </div>
                                )}
                                {task.errorMessage && (
                                  <div className="flex items-center text-red-600">
                                    <span className="w-20 text-gray-500">Error:</span>
                                    <span>{task.errorMessage}</span>
                                  </div>
                                )}
                              </div>

                              {/* Progress Bar */}
                              {task.status !== 'completed' && task.status !== 'failed' && (
                                <div className="mt-4">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-700">
                                      Progress: {Math.round(task.completionPercentage || 0)}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        task.status === 'ongoing' ? 'bg-blue-500' : 'bg-gray-300'
                                      }`}
                                      style={{ width: `${task.completionPercentage || 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}

                              {/* Preview Section */}
                              {task.previewUrl && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                  <h4 className="text-sm font-medium text-gray-800 mb-2">Preview</h4>
                                  <div className="relative">
                                    <img 
                                      src={task.previewUrl} 
                                      alt="Task preview" 
                                      className="w-full max-w-md rounded-lg shadow-md"
                                      style={{ maxHeight: '300px', objectFit: 'contain' }}
                                    />
                                    <div className="mt-2 flex space-x-2">
                                      <Link 
                                        href={task.previewUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-indigo-700 transition-colors"
                                      >
                                        View Preview
                                      </Link>
                                      {task.fullUrl && (
                                        <Link 
                                          href={task.fullUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="bg-gray-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-gray-700 transition-colors"
                                        >
                                          View Full
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Demo Features Section */}
            <div className="mt-8 bg-indigo-50 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-indigo-800 mb-4">Demo Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-medium text-gray-900 mb-2">🎯 Task Status Preview</h3>
                  <p className="text-sm text-gray-600">Real-time monitoring of image generation tasks with visual previews</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-medium text-gray-900 mb-2">📧 Email Pass</h3>
                  <p className="text-sm text-gray-600">Instant access with demo emails - no verification needed</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-medium text-gray-900 mb-2">🚀 Pre-loaded Content</h3>
                  <p className="text-sm text-gray-600">Demo accounts come with sample images and completed tasks</p>
                </div>
              </div>
            </div>

            {/* Demo Email Patterns */}
            {isDemo && (
              <div className="mt-6 bg-yellow-50 rounded-xl p-4">
                <h3 className="font-medium text-yellow-800 mb-2">📋 Demo Email Patterns</h3>
                <p className="text-sm text-yellow-700">
                  You can use these email patterns for demo access: demo@cvphoto.app, test@cvphoto.app, demo+*, test+*
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}