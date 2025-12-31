import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import DeliveryDatePicker from '../components/DeliveryDatePicker';
import QRCode from 'qrcode';

interface Delivery {
  id: string;
  staffName: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  productName: string;
  quantity: number;
  status: 'pending' | 'in_transit' | 'completed';
  deliveryDate: string;
}

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8787';

const STATUS_LABELS = {
  pending: '배송 준비',
  in_transit: '배송 중',
  completed: '완료',
};

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  in_transit: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { admin, token, logout } = useAuthStore();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_transit' | 'completed'>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // QR 모달 상태
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string>('');

  useEffect(() => {
    fetchDeliveries();
  }, [selectedDate]);

  const fetchDeliveries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/delivery/list?date=${selectedDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setDeliveries(result.data.deliveries);
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 담당자 목록 추출
  const staffList = useMemo(() => {
    const staffSet = new Set<string>();
    deliveries.forEach((d) => {
      if (d.staffName) staffSet.add(d.staffName);
    });
    return Array.from(staffSet).sort();
  }, [deliveries]);

  // 필터링된 배송 목록
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      // 상태 필터
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      // 담당자 필터
      if (staffFilter !== 'all' && d.staffName !== staffFilter) return false;
      // 검색어 필터
      if (searchText) {
        const search = searchText.toLowerCase();
        const matchRecipient = d.recipientName.toLowerCase().includes(search);
        const matchAddress = d.recipientAddress.toLowerCase().includes(search);
        const matchProduct = d.productName.toLowerCase().includes(search);
        const matchPhone = d.recipientPhone.includes(search);
        if (!matchRecipient && !matchAddress && !matchProduct && !matchPhone) return false;
      }
      return true;
    });
  }, [deliveries, statusFilter, staffFilter, searchText]);

  // 활성 필터 개수
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (staffFilter !== 'all') count++;
    if (searchText) count++;
    return count;
  }, [statusFilter, staffFilter, searchText]);

  // 필터 초기화
  const clearFilters = () => {
    setStatusFilter('all');
    setStaffFilter('all');
    setSearchText('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // QR 코드 생성 (API 호출)
  const generateQR = async () => {
    if (!token) return;
    try {
      // 1. 서버에서 QR 토큰 생성
      const response = await fetch(`${API_BASE}/api/auth/qr/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ date: selectedDate }),
      });

      const result = await response.json();
      if (!result.success) {
        alert(result.error || 'QR 코드 생성에 실패했습니다.');
        return;
      }

      // 2. 토큰과 날짜를 QR 코드로 변환
      const qrData = JSON.stringify({ token: result.data.token, date: selectedDate });
      const url = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
      });
      setQrImageUrl(url);
      setShowQRModal(true);
    } catch (err) {
      console.error('QR generation failed:', err);
      alert('QR 코드 생성에 실패했습니다.');
    }
  };

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    in_transit: deliveries.filter((d) => d.status === 'in_transit').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <span className="font-bold text-lg text-gray-900 dark:text-white">배송관리</span>
            </div>

            <div className="flex items-center gap-3">
              {/* QR 생성 버튼 */}
              <button
                onClick={generateQR}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/25 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" />
                  <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" />
                  <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" />
                  <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" />
                </svg>
                QR 코드
              </button>

              <Link to="/upload" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-semibold shadow-lg shadow-primary-500/25 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                엑셀 업로드
              </Link>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{admin?.email}</span>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date Picker */}
        <div className="mb-6">
          <DeliveryDatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            description="해당 날짜의 배송 현황을 조회합니다"
          />
        </div>

        {/* Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 mb-6">
          <div className="flex gap-4">
            <div className="card px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="font-bold text-gray-900 dark:text-white">{stats.total}</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">전체</span>
            </div>
            <div className="card px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                <span className="font-bold text-amber-700 dark:text-amber-400">{stats.pending}</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">준비</span>
            </div>
            <div className="card px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <span className="font-bold text-blue-700 dark:text-blue-400">{stats.in_transit}</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">배송중</span>
            </div>
            <div className="card px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <span className="font-bold text-green-700 dark:text-green-400">{stats.completed}</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">완료</span>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* 검색 */}
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="검색 (수령인, 주소, 상품, 연락처)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="input-field pl-10"
              />
            </div>

            {/* 상태 필터 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="input-field w-full sm:w-40"
            >
              <option value="all">전체 상태</option>
              <option value="pending">배송 준비</option>
              <option value="in_transit">배송 중</option>
              <option value="completed">완료</option>
            </select>

            {/* 담당자 필터 */}
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="input-field w-full sm:w-40"
            >
              <option value="all">전체 담당자</option>
              {staffList.map((staff) => (
                <option key={staff} value={staff}>{staff}</option>
              ))}
            </select>

            {/* 필터 초기화 */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                초기화
              </button>
            )}
          </div>

          {/* 필터 결과 */}
          {activeFilterCount > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredDeliveries.length}건 표시 중 (전체 {deliveries.length}건)
              </span>
            </div>
          )}
        </div>

        {/* Deliveries Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {activeFilterCount > 0 ? '필터 조건에 맞는 배송이 없습니다.' : '배송 데이터가 없습니다.'}
              </p>
              {activeFilterCount > 0 ? (
                <button onClick={clearFilters} className="btn-primary">
                  필터 초기화
                </button>
              ) : (
                <Link to="/upload" className="btn-primary">
                  엑셀 업로드하기
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수령인</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">연락처</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주소</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">담당자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredDeliveries.map((delivery, index) => (
                  <tr key={delivery.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-4 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {delivery.recipientName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {delivery.recipientPhone}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {delivery.recipientAddress}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {delivery.productName} x {delivery.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {delivery.staffName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[delivery.status]}`}>
                        {STATUS_LABELS[delivery.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">배송담당자 QR</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex justify-center mb-6">
              {qrImageUrl && (
                <img src={qrImageUrl} alt="QR Code" className="w-64 h-64 rounded-lg" />
              )}
            </div>

            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(selectedDate)}</span>
              </div>
            </div>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              배송담당자가 이 QR을 스캔하면<br />이름 입력 후 배송 목록을 확인할 수 있습니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
