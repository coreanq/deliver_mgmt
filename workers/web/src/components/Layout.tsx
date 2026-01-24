import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isAuthenticated, logout, admin } = useAuthStore();

  const isLanding = location.pathname === '/';
  const isLogin = location.pathname === '/login' || location.pathname === '/auth/verify';

  // 랜딩 페이지와 로그인 페이지는 자체 레이아웃 사용
  if (isLanding || isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-3">
              <img src="/app-icon.png" alt="배매니저" className="w-9 h-9 rounded-xl shadow-sm" />
              <span className="font-bold text-lg text-gray-900 dark:text-white">배매니저</span>
            </Link>
            {isAuthenticated && admin?.email && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/30 rounded-lg border border-violet-100 dark:border-violet-800">
                <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm font-medium text-violet-700 dark:text-violet-300">{admin.email}</span>
              </div>
            )}
          </div>

          <nav className="flex items-center gap-4">
            <a
              href="mailto:support@try-dabble.com"
              className="hidden sm:block text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
            >
              support@try-dabble.com
            </a>

            {isAuthenticated && (
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="로그아웃"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 px-4 sm:px-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>© 2025 배매니저</span>
            <a
              href="mailto:support@try-dabble.com"
              className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium"
            >
              support@try-dabble.com
            </a>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <a
              href="https://periwinkle-foam-a5a.notion.site/2e10f396f354808b85f6dcce7412a3c2"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              개인정보 처리방침
            </a>
            <a
              href="https://periwinkle-foam-a5a.notion.site/2e10f396f35480c3a5a8c6e4bb1c27fc"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              고객 지원
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
