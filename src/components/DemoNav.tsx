"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DemoNav() {
  const pathname = usePathname();
  
  // Only show demo nav on demo-related pages
  const isDemoPage = pathname?.startsWith('/demo') || pathname === '/demo-signup';
  
  if (!isDemoPage) return null;

  return (
    <nav className="bg-indigo-600 text-white px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link 
            href="/demo" 
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === '/demo' 
                ? 'bg-white text-indigo-600' 
                : 'hover:bg-indigo-500'
            }`}
          >
            Demo Dashboard
          </Link>
          <Link 
            href="/demo/test" 
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === '/demo/test' 
                ? 'bg-white text-indigo-600' 
                : 'hover:bg-indigo-500'
            }`}
          >
            Feature Tests
          </Link>
        </div>
        
        <div className="flex items-center space-x-4">
          <Link 
            href="/dashboard" 
            className="bg-white text-indigo-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-indigo-50 transition-colors"
          >
            Main Dashboard
          </Link>
        </div>
      </div>
    </nav>
  );
}