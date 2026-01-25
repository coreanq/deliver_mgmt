import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/app-icon.png" alt="배매니저" className="w-9 h-9 rounded-xl shadow-sm" />
            <span className="font-bold text-lg text-gray-900">배매니저</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="mailto:support@try-dabble.com"
              className="hidden sm:block text-sm text-gray-500 hover:text-violet-600 transition-colors"
            >
              support@try-dabble.com
            </a>
            <Link
              to="/login"
              className="px-5 py-2.5 bg-violet-600 text-white rounded-xl font-medium text-sm hover:bg-violet-700 transition-all shadow-sm hover:shadow-md"
            >
              로그인
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-20">
        {/* PC 안내 배너 */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 text-white">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-center gap-3">
            <span className="text-xl">💻</span>
            <p className="font-medium text-center">
              <span className="font-bold">엑셀 업로드 및 배송 데이터 관리</span>는 PC 브라우저에서 이용해 주세요
            </p>
          </div>
        </div>

        {/* Hero Section */}
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
                {/* Image */}
                <div className="order-2 md:order-1">
                  <img
                    src="/images/hero-main.png"
                    alt="배매니저 앱 사용 모습"
                    className="w-full rounded-2xl"
                  />
                </div>
                {/* Text */}
                <div className="order-1 md:order-2 space-y-6">
                  <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                    배송 관리,<br />이제 스마트하게
                  </h1>
                  <p className="text-gray-600 text-lg leading-relaxed">
                    수기 장부와 복잡한 엑셀에서 벗어나 간편한 앱 하나로 배송 업무를 완벽하게 관리하세요.
                  </p>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-all shadow-md hover:shadow-lg"
                  >
                    무료로 시작하기
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section - "현실" */}
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
              {/* Section Label */}
              <div className="inline-block px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-600 mb-6">
                현실
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12">
                매일 반복되는 배송 관리의 어려움
              </h2>

              <div className="grid md:grid-cols-2 gap-8 items-start">
                {/* Image */}
                <div>
                  <img
                    src="/images/problem-papers.png"
                    alt="배송 관리 어려움"
                    className="w-full rounded-2xl"
                  />
                </div>

                {/* Problems List */}
                <div className="space-y-6">
                  <p className="text-xl font-medium text-gray-800 mb-6">
                    이런 고민, 하고 계신가요?
                  </p>
                  <ul className="space-y-4">
                    {[
                      '종이 주문서를 일일이 확인하고 체크',
                      '배송 기사님께 전화로 일일이 연락',
                      '배송 현황 파악이 어려워 고객 문의 대응 지연',
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-gray-600">
                        <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-sm">
                          !
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-gray-500 italic pt-4 border-t border-gray-100">
                    하루 종일 배송 관리에 시간을 뺏기고 계시진 않나요?
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Analog Limits Section */}
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              아날로그 방식의 한계
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: '⏱️',
                  title: '시간 낭비',
                  desc: '주문 확인, 배송 기사 연락, 고객 응대에 하루 2-3시간 소요',
                  color: 'bg-amber-50 border-amber-100',
                },
                {
                  icon: '⚠️',
                  title: '실수 발생',
                  desc: '수기 기록으로 인한 누락, 중복 주문, 배송지 착오 위험',
                  color: 'bg-red-50 border-red-100',
                },
                {
                  icon: '❓',
                  title: '불투명한 현황',
                  desc: '실시간 배송 상태를 알 수 없어 고객 문의 시 답변 곤란',
                  color: 'bg-gray-50 border-gray-100',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`p-6 rounded-2xl border ${item.color}`}
                >
                  <div className="text-3xl mb-4">{item.icon}</div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <div
              className="rounded-3xl shadow-xl p-8 md:p-12 text-white relative overflow-hidden"
              style={{
                backgroundImage: 'url(/images/solution-bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/90 to-indigo-700/90"></div>

              <div className="relative">
                {/* Section Label */}
                <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-6">
                  솔루션
                </div>

                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  이제는 스마트한 전환이 필요합니다
                </h2>

                <p className="text-lg text-violet-100 max-w-2xl leading-relaxed">
                  기존 엑셀 파일을 그대로 활용하면서, 클릭 몇 번으로 모든 배송 업무를 자동화할 수 있습니다.
                  복잡한 설정 없이 바로 시작 가능합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Features Section */}
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              핵심 기능 한눈에 보기
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: '📊',
                  title: '엑셀 파일 간편 연동',
                  desc: '기존 사용하던 엑셀 주문서를 드래그 앤 드롭으로 바로 업로드. 데이터 자동 변환으로 즉시 사용 가능합니다.',
                  color: 'bg-blue-100 text-blue-700',
                },
                {
                  icon: '📱',
                  title: 'QR 스캔 배송 확인',
                  desc: '배송 기사님이 QR 코드만 찍으면 자동으로 배송 리스트 확인 가능합니다.',
                  color: 'bg-green-100 text-green-700',
                },
                {
                  icon: '⚡',
                  title: '실시간 배송 현황',
                  desc: '어느 주문이 어디까지 갔는지 실시간으로 추적 가능합니다.',
                  color: 'bg-violet-100 text-violet-700',
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.color} text-2xl mb-4`}>
                    {feature.icon}
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard Section - 사장님은 대시보드로 */}
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
              {/* Section Label */}
              <div className="inline-block px-3 py-1 bg-violet-100 rounded-full text-sm font-medium text-violet-600 mb-6">
                관리자 대시보드
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12">
                사장님은 대시보드로 한눈에 관리
              </h2>

              <div className="grid md:grid-cols-2 gap-8 items-start">
                {/* Image */}
                <div>
                  <img
                    src="/images/dashboard.png"
                    alt="관리자 대시보드"
                    className="w-full rounded-2xl border border-gray-200"
                  />
                </div>

                {/* Features List */}
                <div className="space-y-6">
                  <p className="text-xl font-medium text-gray-800 mb-6">
                    PC 웹에서 편리하게 관리하세요
                  </p>
                  <ul className="space-y-4">
                    {[
                      '실시간 현황판 - 진행 중, 배송 완료, 지연 건수 한눈에',
                      '배송 기사별 업무량과 진행 상태 확인',
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-gray-600">
                        <span className="flex-shrink-0 w-6 h-6 bg-violet-100 text-violet-500 rounded-full flex items-center justify-center text-sm">
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-gray-500 italic pt-4 border-t border-gray-100">
                    별도 프로그램 설치 없이 웹 브라우저로 바로 접속
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                도입 효과는 확실합니다
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  value: '70%',
                  label: '업무 시간 단축',
                  desc: '배송 관리에 소요되는 시간을 하루 2시간 이상 절감',
                  color: 'from-blue-500 to-blue-600',
                },
                {
                  value: '95%',
                  label: '주문 정확도',
                  desc: '실수와 누락을 줄여 고객 만족도 대폭 향상',
                  color: 'from-green-500 to-green-600',
                },
                {
                  value: '100%',
                  label: '실시간 가시성',
                  desc: '모든 배송 현황을 언제 어디서나 즉시 확인 가능',
                  color: 'from-violet-500 to-violet-600',
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                  <div className={`text-5xl md:text-6xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r ${stat.color}`}>
                    {stat.value}
                  </div>
                  <div className="font-semibold text-gray-900 mb-2">{stat.label}</div>
                  <p className="text-sm text-gray-500">{stat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">
                시작은 정말 간단합니다
              </h2>

              <div className="grid md:grid-cols-4 gap-8">
                {[
                  { step: '01', title: '앱 다운로드', desc: '앱스토어 또는 구글 플레이에서 무료 설치' },
                  { step: '02', title: '엑셀 업로드', desc: '기존 주문서 파일을 드래그 앤 드롭으로 등록' },
                  { step: '03', title: '배송 기사 초대', desc: '간편한 QR 코드로 배송 기사님 배송 리스트 확인 가능' },
                  { step: '04', title: '즉시 사용', desc: '복잡한 설정 없이 바로 배송 관리 시작' },
                ].map((item) => (
                  <div key={item.step} className="text-center">
                    <div className="w-14 h-14 mx-auto bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center font-bold text-xl mb-4">
                      {item.step}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl shadow-xl p-8 md:p-12 text-center text-white">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                지금 바로 시작하세요
              </h2>
              <p className="text-lg text-violet-100 mb-8">
                하루 100 건 무료 체험으로 부담 없이 시작하실 수 있습니다
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-violet-600 rounded-xl font-semibold text-lg hover:bg-violet-50 transition-all shadow-lg"
              >
                무료로 시작하기
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12 px-6 mt-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src="/app-icon.png" alt="배매니저" className="w-8 h-8 rounded-lg" />
              <span className="font-semibold text-gray-900">배매니저</span>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-4 text-sm text-gray-500">
              <a
                href="mailto:support@try-dabble.com"
                className="hover:text-violet-600 transition-colors font-medium"
              >
                support@try-dabble.com
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://periwinkle-foam-a5a.notion.site/2e10f396f354808b85f6dcce7412a3c2"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-violet-600 transition-colors"
              >
                개인정보 처리방침
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://periwinkle-foam-a5a.notion.site/2e10f396f35480c3a5a8c6e4bb1c27fc"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-violet-600 transition-colors"
              >
                고객 지원
              </a>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-400">
            © 2025 배매니저. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
