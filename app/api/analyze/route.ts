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
            text: `${processNamePrompt}업로드된 이미지를 분석하여 산업안전 측면에서 위험요인, 위험성, 개선방안 및 관련 규정을 식별해주세요.

만약 이미지에서 산업안전 관련 위험 요소가 발견되지 않는다면 (예: 일반 문서, 풍경 사진 등) 다음과 같이 응답해주세요:
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
<thead><tr style="background-color: #f2f2f2;"><th>위험 요소</th><th>중대성</th><th>가능성</th><th>위험도</th><th>공학적 개선방안</th><th>관리적 개선방안</th></tr></thead>
<tbody><tr><td>사진에서 발견된 위험성은 없습니다.</td><td>-</td><td>-</td><td>-</td><td>추가적인 공학적 안전 조치가 필요하지 않습니다.</td><td>추가적인 관리적 안전 조치가 필요하지 않습니다.</td></tr></tbody>
</table>

위험 요소가 발견된 경우에는 다음 형식으로 응답해주세요:
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
<thead><tr style="background-color: #f2f2f2;"><th>위험 요소</th><th>중대성</th><th>가능성</th><th>위험도</th><th>공학적 개선방안</th><th>관리적 개선방안</th></tr></thead>
<tbody>
<tr><td>위험 요소 1 (구체적으로 서술)</td><td>1~5 점수</td><td>1~5 점수</td><td>높음/중간/낮음</td><td>공학적 개선방안 내용 (설비, 장비, 환경 등 물리적 개선사항)</td><td>관리적 개선방안 내용 (교육, 훈련, 절차, 지침 등)</td></tr>
<tr><td>위험 요소 2 (구체적으로 서술)</td><td>1~5 점수</td><td>1~5 점수</td><td>높음/중간/낮음</td><td>공학적 개선방안 내용</td><td>관리적 개선방안 내용</td></tr>
</tbody>
</table>

그리고 위험 요소와 관련된 규정은 다음과 같은 별도의 테이블로 제공해주세요:
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
<thead><tr style="background-color: #f2f2f2;"><th>관련 규정</th></tr></thead>
<tbody>
<tr><td>관련 규정 1</td></tr>
<tr><td>관련 규정 2 (필요시)</td></tr>
</tbody>
</table>

관련 규정 작성 시 다음 지침을 반드시, 필수적으로 따라주세요:

1. 산업안전보건법 및 관련 하위 법령의 정확한 조항을 다음 형식으로 명시해야 합니다: 
   - 정확한 형식: "산업안전보건법 제38조(안전조치)"
   - 하위 법령 형식: "산업안전보건기준에 관한 규칙 제32조(보호구의 지급 등)"

2. 법령 표기 시 다음 정확한 법령명을 사용해주세요:
   - 산업안전보건법
   - 산업안전보건법 시행령
   - 산업안전보건법 시행규칙
   - 산업안전보건기준에 관한 규칙
   - 건설업 산업안전보건관리비 계상 및 사용기준
   - 위험물안전관리법
   - 화재예방, 소방시설 설치ㆍ유지 및 안전관리에 관한 법률
   - 전기사업법
   - 석면안전관리법

3. 법령의 조문은 다음 사항에 유의하여 정확히 표기하세요:
   - 조: "제31조"처럼 정확한 숫자로 표기
   - 항: "제31조제1항"처럼 띄어쓰기 없이 표기
   - 호: "제31조제1항제2호"처럼 띄어쓰기 없이 표기
   - 조문 제목: "제31조(안전보건관리책임자)"처럼 괄호 안에 표기

4. 법령 조문은 인터넷정보를 확인하여 최신정보로 정확하게 확인되는 경우에만 표기하세요.

5. 산업안전보건법에서 주요 조항의 내용을 다음과 같이 참고하세요:
   - 제38조(안전조치): 떨어짐, 붕괴, 물체에 맞음 방지
   - 제39조(보건조치): 유해물질, 소음, 진동, 이상기온 관련
   - 제40조(기계·기구 등): 위험기계, 방호장치, 검사
   - 제56조(위험성평가): 위험성평가 실시
   - 제63조(안전보건교육): 근로자 교육
   - 제64조(고객의 폭언등으로 인한 건강장해 예방조치): 감정노동 보호

6. 산업안전보건기준에 관한 규칙에서 주요 조항:
   - 제32조~제39조: 보호구 관련
   - 제42조~제46조: 추락 방지
   - 제86조~제99조: 위험기계기구 방호장치
   - 제132조~제165조: 전기 작업 안전
   - 제171조~제200조: 기계 작업 안전
   - 제301조~제315조: 화재/폭발 위험작업
   - 제422조~제433조: 환기장치
   - 제434조~제449조: 소음/진동 보건기준

위험요소는 구체적이고 서술형으로 작성해주세요. 중대성(Severity)은 1~4 사이의 정수로 평가해 주세요.
   - 4: 최대
   - 3: 대
   - 2: 중
   - 1: 소
가능성(Probability)은 1~5 사이의 정수로 평가해 주세요.
   - 5: 가능성 5(최고)
   - 4: 가능성 4
   - 3: 가능성 3
   - 2: 가능성 2
   - 1: 가능성 1(최저)
위험도는 중대성과 가능성을 고려하여 다음과 같이 표시합니다:
   - 상(15~20점): 위험도 '상(점수)' 형식으로 표시 (예: 상(16))
   - 중(8~12점): 위험도 '중(점수)' 형식으로 표시 (예: 중(12))
   - 하(1~6점): 위험도 '하(점수)' 형식으로 표시 (예: 하(4))

HTML 테이블만 제공해주세요. 코드 블록 마크다운(\`\`\`html)을 사용하지 말고 순수 HTML만 반환해주세요. 한국어로 응답해주세요.`
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