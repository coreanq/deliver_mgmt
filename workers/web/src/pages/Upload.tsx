import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useUploadStore } from '../stores/upload';

export default function Upload() {
  const navigate = useNavigate();
  const { setData, setLoading, setError, error, isLoading } = useUploadStore();
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        setError('엑셀 파일(.xlsx, .xls) 또는 CSV 파일만 업로드할 수 있습니다.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);

        // 첫 번째 시트 사용
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
          raw: false,
          defval: '',
        });

        if (jsonData.length === 0) {
          setError('파일에 데이터가 없습니다.');
          setLoading(false);
          return;
        }

        // 헤더 추출
        const headers = Object.keys(jsonData[0]);

        // 스토어에 저장
        setData(headers, jsonData);

        // 매핑 페이지로 이동
        navigate('/mapping');
      } catch (err) {
        console.error('File parse error:', err);
        setError('파일을 읽는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [navigate, setData, setError, setLoading]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              돌아가기
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">엑셀 업로드</h1>
          <p className="text-gray-500 dark:text-gray-400">배송 데이터가 담긴 엑셀 파일을 업로드하세요.</p>
        </div>

        {/* Dropzone */}
        <div
          className={`dropzone ${isDragging ? 'active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            type="file"
            id="file-input"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">파일을 처리하는 중...</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                파일을 여기에 드래그하거나 클릭하여 선택
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                .xlsx, .xls, .csv 파일 지원
              </p>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 card p-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">엑셀 파일 준비 가이드</h3>
          <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              첫 번째 행에 컬럼 헤더가 있어야 합니다.
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              필수 정보: 수령인 이름, 연락처, 주소, 상품명
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              선택 정보: 수량, 메모, 배송담당자, 배송일
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-primary-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              AI가 자동으로 컬럼을 매핑해드립니다.
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
