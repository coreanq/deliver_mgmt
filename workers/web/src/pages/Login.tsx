import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8787';
const WEB_VERSION = '1.0.0';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuthStore();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const [serverBuildDate, setServerBuildDate] = useState('');

  // 이미 로그인된 경우 대시보드로 이동
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // 다른 탭에서 로그인 완료 시 감지 (storage 이벤트)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-storage' && e.newValue) {
        const data = JSON.parse(e.newValue);
        if (data.state?.isAuthenticated) {
          window.location.href = '/';
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 서버 빌드 날짜 가져오기
  useEffect(() => {
    const fetchServerBuildDate = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        const data = await res.json();
        if (data.buildDate) {
          setServerBuildDate(data.buildDate);
        }
      } catch {
        // 서버 연결 실패 시 무시
      }
    };
    fetchServerBuildDate();
  }, []);

  // Magic Link 토큰 검증 (모바일이면 앱으로 리다이렉트 시도)
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // 모바일 기기 감지 (User-Agent + 화면 크기 + 터치 기능)
      const userAgentMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const smallScreen = window.innerWidth <= 768;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // User-Agent가 모바일이고 작은 화면일 때만 모바일로 판단
      const isMobile = userAgentMobile && smallScreen;

      if (isMobile) {
        // 앱 딥링크로 리다이렉트 시도
        const deepLink = `deliver-mgmt://auth/verify?token=${token}`;

        // 딥링크 시도 후 일정 시간 내에 페이지가 안 바뀌면 웹에서 처리
        const timeout = setTimeout(() => {
          verifyToken(token);
        }, 2000);

        // 딥링크 시도
        window.location.href = deepLink;

        // 페이지 이탈 시 타임아웃 취소
        window.addEventListener('pagehide', () => clearTimeout(timeout), { once: true });
      } else {
        // PC는 웹에서 처리
        verifyToken(token);
      }
    }
  }, [searchParams]);

  const verifyToken = async (token: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/magic-link/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        login(result.data.admin, result.data.token);
        // 이메일 링크로 열린 새 탭이면 닫기 시도, 안 되면 대시보드로 이동
        window.close();
        // window.close()가 안 되는 경우 (직접 열린 탭)
        setTimeout(() => navigate('/'), 100);
      } else {
        setError(result.error || '링크가 만료되었거나 유효하지 않습니다.');
      }
    } catch {
      setError('인증에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('이메일을 입력하세요.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/magic-link/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.success) {
        // 테스트 이메일이면 바로 JWT 반환됨 → 로그인
        if (result.data?.token) {
          login(result.data.admin, result.data.token);
          navigate('/');
        } else {
          // 일반 이메일이면 Magic Link 발송됨
          setIsSent(true);
        }
      } else {
        setError(result.error || '이메일 발송에 실패했습니다.');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/app-icon.png"
            alt="배매니저"
            className="w-16 h-16 rounded-2xl shadow-lg shadow-primary-500/25 mb-4 mx-auto"
          />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">배매니저</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">관리자 로그인</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          {!isSent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  이메일 주소
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="admin@example.com"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    이메일로 로그인
                  </>
                )}
              </button>

              {!import.meta.env.PROD && (
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  테스트: dev@test.com 또는 dev@example.com
                </p>
              )}
            </form>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 dark:bg-green-900/30">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                이메일을 확인하세요!
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {email}로<br />로그인 링크를 보냈습니다.
              </p>
              <button
                onClick={() => setIsSent(false)}
                className="text-primary-600 hover:text-primary-700 font-medium dark:text-primary-400"
              >
                다시 보내기
              </button>
            </div>
          )}
        </div>

        {/* 버전 정보 */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Web v{WEB_VERSION}
          </p>
          {serverBuildDate && (
            <p className="text-xs text-gray-400 dark:text-gray-600">
              Server {serverBuildDate}
            </p>
          )}
          <div className="pt-2">
            <Link
              to="/support"
              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
            >
              고객 지원 (Support)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
