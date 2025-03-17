import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { selectedItems } = await request.json();

    if (!selectedItems) {
      return NextResponse.json(
        { error: '선택된 항목이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // Gemini API 키 확인 - 환경 변수 이름 통일
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('API 키가 설정되지 않음 - 환경 변수 누락');
      return NextResponse.json(
        { error: 'Gemini API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }
    
    // Gemini API 초기화 - 모델 버전 업데이트
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // 선택된 항목을 병합하여 최종 위험성평가표 생성 요청
    console.log('최종 분석 API 요청 시작');
    const result = await model.generateContent([
      {
        text: "다음은 여러 위험성평가표에서 선택된 항목들입니다. 이 항목들을 분석하여 하나의 통합된 위험성평가표로 만들어주세요. 위험요소의 비슷한 그룹끼리 묶어주고, 중복된 내용은 제거해서 제대로된 위험성평가표로 만들어주세요. 위험요소 부분은 서술형으로 작성하고, 중대성은 1~4 척도, 가능성은 1~5 척도로 표현해주세요. 위험도 점수는 중대성 × 가능성으로 계산하며, 반드시 위험도는 '등급(점수)' 형식으로 표시해주세요. 예: 중(12), 상(16), 하(4). 위험도 등급은 다음과 같이 판단합니다: 상(15~20점), 중(8~12점), 하(1~6점). 선택된 항목들: " + selectedItems + " 다음과 같은 형식으로 HTML 테이블을 생성해주세요: <table border=\"1\" cellpadding=\"8\" cellspacing=\"0\" style=\"border-collapse: collapse; width: 100%;\"><thead><tr style=\"background-color: #f2f2f2;\"><th>위험 요소</th><th>중대성(1-4)</th><th>가능성(1-5)</th><th>위험도</th><th>대책</th></tr></thead><tbody><tr><td>위험 요소 1</td><td>1~4</td><td>1~5</td><td>상(16)/중(12)/하(4)</td><td>대책 내용</td></tr></tbody></table> 다른 설명이나 형식적인 표현 없이 HTML 테이블만 제공해주세요. 코드 블록 마크다운(```html)을 사용하지 말고 순수 HTML만 반환해주세요. 한국어로 응답해주세요."
      },
    ]);

    const response = result.response;
    let analysis = response.text();
    console.log('최종 분석 API 응답 수신 완료 (길이: ' + analysis.length + ')');
    
    // 코드 블록 마크다운 제거
    analysis = analysis.replace(/```html|```/g, '').trim();

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('위험성평가표 병합 오류:', error);
    return NextResponse.json(
      { error: '위험성평가표 병합 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 