'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 섹션 */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto py-6 px-4 md:px-6">
          <h1 className="text-3xl md:text-4xl font-bold">안전 위험성 평가 서비스</h1>
          <p className="mt-2 text-lg md:text-xl">사진 분석으로 산업현장의 위험요소를 발견하고 개선하세요</p>
        </div>
      </header>

      {/* 메인 서비스 소개 섹션 */}
      <section className="container mx-auto py-12 px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800">혁신적인 위험성 평가 솔루션</h2>
          <p className="mt-4 text-xl text-gray-600">
            AI 기반 사진 분석을 통해 산업현장의 안전 위험요소를 신속하게 파악하고 개선 방안을 제시합니다
          </p>
        </div>

        {/* 서비스 카드 섹션 */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* 사진으로 보는 위험 */}
          <Link href="/camera" className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">
            <div className="p-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">사진으로 보는 위험</h3>
              <p className="text-gray-600 mb-6">
                작업 현장의 사진을 찍으면 AI가 실시간으로 위험 요소를 감지하고 
                관련 법령과 개선 방안을 제시합니다.
              </p>
            </div>
          </Link>

          {/* 위험성평가 도구 */}
          <Link href="/assessment" className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">
            <div className="p-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">위험성평가 도구</h3>
              <p className="text-gray-600 mb-6">
                작업 현장의 사진을 업로드하면 AI가 자동으로 위험성을 평가하고 
                위험성평가표를 생성합니다. 지금 바로 시작하세요.
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* 특징 섹션 */}
      <section className="bg-gray-200 py-12">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-10">서비스 특징</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-center">신속한 위험 탐지</h3>
              <p className="text-gray-600 text-center mt-2">AI 기술을 활용하여 초고속으로 위험 요소를 찾아냅니다</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-center">정확한 분석</h3>
              <p className="text-gray-600 text-center mt-2">고도로 훈련된 AI 모델이 산업 안전 표준에 맞게 위험을 정확히 분석합니다</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-center">맞춤형 개선 제안</h3>
              <p className="text-gray-600 text-center mt-2">감지된 위험에 대한 구체적인 개선 방안을 제공합니다</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto text-center px-4">
          <h2 className="text-3xl font-bold mb-4">안전한 산업 환경을 위한 첫걸음</h2>
          <p className="text-xl mb-8">지금 바로 위험성 평가 도구를 사용해보세요</p>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center">
            <p>© {new Date().getFullYear()} 안전 위험성 평가 서비스. 모든 권리 보유.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 