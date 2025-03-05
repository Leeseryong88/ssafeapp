// 'use client' 지시문 제거
// React 관련 임포트 제거
// useEffect 코드 제거

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// API 응답 타입 정의
interface ApiResponse {
  analysis?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const processName = formData.get('processName') as string || ''; // 프로세스 이름 추출

    if (!imageFile) {
      return NextResponse.json<ApiResponse>(
        { error: '이미지 파일이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 이미지 유효성 검사
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(imageFile.type)) {
      return NextResponse.json<ApiResponse>(
        { error: '지원되지 않는 이미지 형식입니다. JPEG, PNG, GIF, WebP 형식만 허용됩니다.' },
        { status: 400 }
      );
    }

    // 이미지를 base64로 변환
    const imageBytes = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBytes).toString('base64');

    // Gemini API 키 확인
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('API 키가 설정되지 않음 - 환경 변수 누락');
      return NextResponse.json<ApiResponse>(
        { error: 'API 키가 설정되지 않았습니다. 서버 관리자에게 문의하세요.' },
        { status: 500 }
      );
    }
    
    console.log('이미지 분석 API - API 키 설정 확인됨');

    // Gemini API 초기화 - 최신 모델 사용
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    console.log('이미지 분석 API 요청 시작');
    
    try {
      // 타임아웃 설정 - AbortController 사용 (50초로 조정 - Vercel 제한 60초 내로 설정)
      const timeoutMs = 50000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('이미지 분석 API 타임아웃 발생 - ' + timeoutMs + 'ms 초과');
      }, timeoutMs);
      
      // 프로세스 이름에 따른 프롬프트 추가
      const processNamePrompt = processName 
        ? `이 사진은 "${processName}"입니다. ` 
        : '';
      
      // 이미지 분석 요청
      const result = await Promise.race([
        model.generateContent([
          {
            text: `${processNamePrompt}업로드된 이미지를 분석하여 위험성평가표를 생성해주세요. 이미지에서 발견된 위험 요소들을 식별하고, 각 위험 요소에 대한 중대성과 가능성을 1~5 척도로 평가해주세요. 위험요소 부분은 서술형으로 작성해주세요. 다음과 같은 형식으로 HTML 테이블을 생성해주세요: <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;"><thead><tr style="background-color: #f2f2f2;"><th>위험 요소</th><th>중대성</th><th>가능성</th><th>위험도</th><th>대책</th></tr></thead><tbody><tr><td>위험 요소 1</td><td>1~5</td><td>1~5</td><td>높음/중간/낮음</td><td>대책 내용</td></tr></tbody></table> 다른 설명이나 형식적인 표현 없이 HTML 테이블만 제공해주세요. 코드 블록 마크다운(\`\`\`html)을 사용하지 말고 순수 HTML만 반환해주세요. 한국어로 응답해주세요.`
          },
          {
            inlineData: {
              mimeType: `image/${imageFile.type.split('/')[1]}`,
              data: base64Image
            }
          }
        ]),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('요청 시간이 초과되었습니다.'));
          }, timeoutMs);
        })
      ]);
      
      // 타임아웃 해제
      clearTimeout(timeoutId);
      
      const response = result.response;
      let analysis = response.text();
      console.log('이미지 분석 API 응답 수신 완료 (길이: ' + analysis.length + ')');
      
      // 코드 블록 마크다운 제거 및 HTML 정리
      analysis = analysis.replace(/```html|```/g, '').trim();
      
      // 결과가 비어있는 경우 체크
      if (!analysis || analysis.length < 10) {
        return NextResponse.json<ApiResponse>(
          { error: '분석 결과가 비어있습니다. 다른 이미지로 다시 시도해주세요.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json<ApiResponse>({ analysis });
      
    } catch (error: any) {
      console.error('이미지 분석 요청 오류:', error.message);
      
      if (error.message.includes('시간이 초과')) {
        return NextResponse.json<ApiResponse>(
          { error: '분석 요청 시간이 초과되었습니다. 서버 부하가 높거나 이미지가 너무 복잡합니다. 다시 시도해주세요.' },
          { status: 504 }
        );
      }
      
      throw error; // 다른 오류는 외부 catch 블록으로 전달
    }
    
  } catch (error: any) {
    console.error('이미지 분석 오류:', error);
    return NextResponse.json<ApiResponse>(
      { error: `이미지 분석 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
} 