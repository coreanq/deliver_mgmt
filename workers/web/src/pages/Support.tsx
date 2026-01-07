import React from 'react';
import { Link } from 'react-router-dom';

export default function Support() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                    <img
                        src="/app-icon.png"
                        alt="배매니저"
                        className="w-20 h-20 rounded-2xl shadow-lg shadow-primary-500/25 mb-4 mx-auto"
                    />
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">고객 지원 (Support)</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">배매니저 서비스 이용 중 도움이 필요하신가요?</p>
                </div>

                <div className="card p-8 space-y-8">
                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg flex items-center justify-center text-sm">01</span>
                            문의하기
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            앱 사용 중 발생하는 오류, 기능 제안, 또는 기타 문의사항이 있으시면 아래 이메일로 연락 주시기 바랍니다.
                            영업일 기준 24시간 이내에 답변을 드릴 수 있도록 최선을 다하겠습니다.
                        </p>
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">이메일 주소</p>
                            <a
                                href="mailto:support@try-dabble.com"
                                className="text-lg font-medium text-primary-600 dark:text-primary-400 hover:underline"
                            >
                                support@try-dabble.com
                            </a>
                        </div>
                    </section>

                    <hr className="border-gray-100 dark:border-gray-800" />

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg flex items-center justify-center text-sm">02</span>
                            주요 안내 사항
                        </h2>
                        <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                            <li className="flex gap-2">
                                <span className="text-primary-500">•</span>
                                <span>관리자 계정은 Magic Link를 통해 안전하게 로그인할 수 있습니다.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-primary-500">•</span>
                                <span>배송담당자는 관리자가 생성한 QR 코드를 스캔하여 즉시 업무를 시작할 수 있습니다.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-primary-500">•</span>
                                <span>배송 완료 사진은 개인정보 보호를 위해 7일 후 자동 삭제됩니다.</span>
                            </li>
                        </ul>
                    </section>

                    <div className="pt-4 text-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            로그인 화면으로 돌아가기
                        </Link>
                    </div>
                </div>

                <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600">
                    &copy; 2026 배매니저 (Deliver Mgmt). All rights reserved.
                </p>
            </div>
        </div>
    );
}
