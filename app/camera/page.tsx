'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';

interface Analysis {
  risk_factors: string[];
  improvements: string[];
  regulations: string[];
}

export default function CameraPage() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // API 호출 및 분석
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('processName', '현장 사진');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '이미지 분석 중 오류가 발생했습니다.');
      }

      const data = await response.json();
      
      if (!data.analysis) {
        throw new Error('분석 결과를 받지 못했습니다.');
      }

      // HTML 파싱을 위한 임시 div 생성
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.analysis;

      // 테이블에서 데이터 추출
      const rows = tempDiv.querySelectorAll('tbody tr');
      const analysisData: Analysis = {
        risk_factors: [],
        improvements: [],
        regulations: []
      };

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
          const riskFactor = cells[0]?.textContent?.trim();
          const improvement = cells[4]?.textContent?.trim();
          
          if (riskFactor) analysisData.risk_factors.push(riskFactor);
          if (improvement) analysisData.improvements.push(improvement);
        }
      });

      // 관계법령 제거
      setAnalysis(analysisData);
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || '이미지 분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const openCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 분석 결과를 HTML 테이블로 변환하는 함수
  const renderAnalysisTable = (analysis: Analysis) => {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-3 text-gray-800">위험 요인</h3>
          <div className="bg-white rounded-lg shadow p-4">
            <ul className="list-disc list-inside space-y-2">
              {analysis.risk_factors.map((risk, index) => (
                <li key={index} className="text-gray-700">{risk}</li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3 text-gray-800">개선 방안</h3>
          <div className="bg-white rounded-lg shadow p-4">
            <ul className="list-disc list-inside space-y-2">
              {analysis.improvements.map((improvement, index) => (
                <li key={index} className="text-gray-700">{improvement}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">사진으로 보는 위험</h1>
          <p className="text-lg text-gray-600">
            작업 현장의 사진을 찍으면 AI가 실시간으로 위험 요소를 감지하고 관련 법령과 개선 방안을 제시합니다.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden mb-8">
          <div className="p-6">
            <div className="flex flex-col gap-8">
              {/* 카메라/이미지 영역 */}
              <div className="w-full">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCapture}
                    ref={fileInputRef}
                    className="hidden"
                  />
                  
                  {capturedImage ? (
                    <div className="relative aspect-[16/9] mb-4">
                      <Image
                        src={capturedImage}
                        alt="Captured"
                        fill
                        className="object-contain rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                      <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                  
                  <button
                    onClick={openCamera}
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {capturedImage ? '다시 촬영' : '사진 촬영'}
                  </button>
                </div>
              </div>

              {/* 분석 결과 영역 */}
              <div className="w-full">
                {isLoading ? (
                  <div className="bg-white rounded-lg shadow p-8 flex flex-col items-center justify-center min-h-[200px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-lg text-gray-700">이미지 분석 중...</p>
                  </div>
                ) : analysis ? (
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                    {renderAnalysisTable(analysis)}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow p-8 flex flex-col items-center justify-center min-h-[200px] text-center">
                    <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-600">
                      사진을 촬영하면 AI가 자동으로 위험 요소를 분석하여 표시합니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 