import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imagesData = JSON.parse(formData.get('images') as string);
    const processNames = JSON.parse(formData.get('processNames') as string);
    
    // 위험성평가 매트릭스 데이터 파싱
    const severityLevels = JSON.parse(formData.get('severityLevels') as string);
    const probabilityLevels = JSON.parse(formData.get('probabilityLevels') as string);
    const riskMatrix = JSON.parse(formData.get('riskMatrix') as string);
    
    // 기존 데이터가 있으면 파싱
    const existingData = formData.has('existingData') 
      ? JSON.parse(formData.get('existingData') as string) 
      : [];

    // Gemini API 설정
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // 프롬프트 구성
    const prompt = `
위험성평가표를 작성해주세요. 다음 정보를 사용하세요:

[공정 정보]
${processNames.map((name: string) => `- ${name}`).join('\n')}

[위험성평가 매트릭스]
중대성(severity) 등급: (1~4 척도, 가로축)
- 4: 최대
- 3: 대
- 2: 중
- 1: 소

가능성(probability) 등급: (1~5 척도, 세로축)
- 5: 가능성 5
- 4: 가능성 4
- 3: 가능성 3
- 2: 가능성 2
- 1: 가능성 1

위험도 = 두 값의 곱으로 계산됩니다.

위험도 점수에 따른 등급:
- 상(15~20점): 위험도 '상(점수)' 형식으로 표시 (예: 상(16))
- 중(8~12점): 위험도 '중(점수)' 형식으로 표시 (예: 중(12))
- 하(1~6점): 위험도 '하(점수)' 형식으로 표시 (예: 하(6))

이미지에서 발견한 각 위험요소에 대해 위 등급을 적용하여 평가해주세요.
반드시 위험도 표시 시 '등급(점수)' 형식을 사용해주세요. 예: 가능성이 5이고 중대성이 4라면 위험도는 '상(20)'으로 표시합니다.

[기존 위험요소]
${existingData.length > 0 ? existingData.map((item: any) => 
  `공정: ${item.processName}, 위험요소: ${item.riskFactor}, 중대성: ${item.severity}, 가능성: ${item.probability}, 위험도: ${item.riskLevel}, 개선대책: ${item.countermeasure}`
).join('\n') : '기존 데이터 없음'}

HTML 테이블과 JSON 형식의 데이터를 모두 제공해주세요. JSON 구조는 다음과 같습니다:
[{
  "processName": "공정명",
  "riskFactor": "위험요소",
  "severity": "중대성 숫자 (1-4)",
  "probability": "가능성 숫자 (1-5)",
  "riskLevel": "위험도 등급 (상/중/하)",
  "riskScore": "위험도 점수 (중대성 × 가능성)",
  "countermeasure": "개선대책"
}]

각 위험요소에 대해 중대성과 가능성을 정확하게 평가하고, 첨부한 매트릭스에 따라 위험도 점수와 등급을 산출해 주세요.
HTML에서 위험도 표시는 반드시 '등급(점수)' 형식으로 표시해주세요. 예: 상(16), 중(12), 하(4)

응답은 <TABLE>...</TABLE> 태그와 <JSON>...</JSON> 태그를 사용하여 분리해주세요.
    `;

    // API 요청
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // 응답에서 표와 JSON 데이터 추출
    const tableMatch = text.match(/<TABLE>([\s\S]*?)<\/TABLE>/i);
    const jsonMatch = text.match(/<JSON>([\s\S]*?)<\/JSON>/i);

    let tableHTML = '';
    let tableData = [];

    if (tableMatch && tableMatch[1]) {
      tableHTML = tableMatch[1].trim();
      
      // HTML에서 "중간" -> "중"으로 변경 및 위험도 형식 통일
      tableHTML = tableHTML.replace(/중간(?!\([0-9]+\))/g, '중');
      
      // 위험도 열에서 숫자가 없는 값을 찾아 숫자를 추가
      // "상", "중", "하" 형식을 "상(15)" 같은 형식으로 변환
      // 테이블의 4번째 열(위험도)을 찾아서 처리
      const tdRegex = /<tr[^>]*>(?:[^<]*<td[^>]*>[^<]*<\/td>){3}\s*<td[^>]*>\s*(상|중|하)(?!\s*\([0-9]+\))\s*<\/td>/gi;
      tableHTML = tableHTML.replace(tdRegex, (match, level) => {
        let score = 0;
        if (level === '상') score = 15;
        else if (level === '중') score = 9;
        else if (level === '하') score = 4;
        return match.replace(level, `${level}(${score})`);
      });
      
      // 특정 단어(중간/중)를 찾아서 일관되게 "중"으로 변경
      tableHTML = tableHTML.replace(/>(\s*)중간(\s*)</g, '>$1중$2<');
    }

    if (jsonMatch && jsonMatch[1]) {
      try {
        tableData = JSON.parse(jsonMatch[1].trim());
        
        // JSON 데이터에서 위험도 점수와 등급이 없는 경우 계산
        tableData = tableData.map((row: any) => {
          const severity = parseInt(row.severity) || 3;
          const probability = parseInt(row.probability) || 3;
          const score = severity * probability;
          
          let level = '중';
          if (score >= 15) level = '상';
          else if (score <= 6) level = '하';
          
          // 위험도에서 "중간"을 "중"으로 변경
          if (row.riskLevel && typeof row.riskLevel === 'string') {
            row.riskLevel = row.riskLevel.replace(/중간/g, '중');
          }
          
          // 위험도를 "등급(점수)" 형식으로 통일
          // 이미 "()" 형식이 있는지 확인
          const hasFormat = row.riskLevel && row.riskLevel.match(/\([0-9]+\)/);
          const formattedRiskLevel = hasFormat ? row.riskLevel : `${level}(${score})`;
          
          return {
            ...row,
            riskScore: row.riskScore || score.toString(),
            riskLevel: formattedRiskLevel
          };
        });
      } catch (e) {
        console.error('JSON 파싱 오류:', e);
      }
    }

    return NextResponse.json({
      tableHTML,
      tableData
    });
  } catch (error) {
    console.error('위험성평가 API 오류:', error);
    return NextResponse.json(
      { error: '위험성평가 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 