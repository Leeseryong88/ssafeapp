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
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일 저장
    setImageFile(file);
    setAnalysisError(null);

    // 이미지 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // 이미지 분석 실행
    await analyzeImage(file);
  };

  // 이미지 분석 함수
  const analyzeImage = async (file: File) => {
    setIsLoading(true);
    setAnalysisError(null);
    
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

      // 분석 결과 설정
      setAnalysis(analysisData);
      setAnalysisError(null);
    } catch (error: any) {
      console.error('Error:', error);
      setAnalysisError(error.message || '이미지 분석 중 오류가 발생했습니다.');
      alert(error.message || '이미지 분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 다시 분석하기 함수
  const handleReanalyze = async () => {
    if (!imageFile && !capturedImage) {
      alert('분석할 이미지가 없습니다. 먼저 사진을 촬영해주세요.');
      return;
    }
    
    if (imageFile) {
      await analyzeImage(imageFile);
    } else if (capturedImage) {
      // base64 이미지를 File 객체로 변환
      try {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const file = new File([blob], "recaptured-image.jpg", { type: 'image/jpeg' });
        setImageFile(file);
        await analyzeImage(file);
      } catch (error) {
        console.error("이미지 변환 중 오류 발생:", error);
        setAnalysisError("이미지를 다시 분석할 수 없습니다. 새 이미지를 촬영해주세요.");
      }
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
              {analysis.risk_factors.length > 0 ? (
                analysis.risk_factors.map((risk, index) => (
                  <li key={index} className="text-gray-700">{risk}</li>
                ))
              ) : (
                <li className="text-gray-500">감지된 위험 요인이 없습니다.</li>
              )}
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3 text-gray-800">개선 방안</h3>
          <div className="bg-white rounded-lg shadow p-4">
            <ul className="list-disc list-inside space-y-2">
              {analysis.improvements.length > 0 ? (
                analysis.improvements.map((improvement, index) => (
                  <li key={index} className="text-gray-700">{improvement}</li>
                ))
              ) : (
                <li className="text-gray-500">제안된 개선 방안이 없습니다.</li>
              )}
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
                  
                  <div className="flex gap-4">
                    <button
                      onClick={openCamera}
                      className={`flex-1 ${capturedImage ? 'bg-blue-600' : 'bg-blue-600'} text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center`}
                    >
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {capturedImage ? '다시 촬영' : '사진 촬영'}
                    </button>
                    
                    {capturedImage && (
                      <button
                        onClick={handleReanalyze}
                        className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center"
                        disabled={isLoading}
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        다시 분석하기
                      </button>
                    )}
                  </div>
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
                ) : analysisError ? (
                  <div className="bg-white rounded-lg shadow p-8 flex flex-col items-center justify-center min-h-[200px] text-center">
                    <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-600 mb-6">{analysisError}</p>
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