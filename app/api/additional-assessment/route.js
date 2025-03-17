import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// API 키를 명시적으로 로깅하여 디버깅 (실제 운영 환경에서는 비활성화 필요)
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";

// 단순화된 위험 요소 추출 함수
function extractRiskFactors(analysisItems) {
  if (!analysisItems || !Array.isArray(analysisItems) || analysisItems.length === 0) {
    console.log('추출할 분석 항목이 없음');
    return [];
  }
  
  const riskFactors = [];
  
  try {
    // 각 분석 항목에서 텍스트 추출
    for (const item of analysisItems) {
      if (!item.analysis || typeof item.analysis !== 'string') {
        continue;
      }
      
      // HTML 태그 제거
      const plainText = item.analysis.replace(/<[^>]*>/g, ' ');
      const lines = plainText.split('\n');
      
      // '위험 요소' 또는 '위험요소'가 포함된 줄의 다음 줄을 추출
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1].trim();
        
        if ((line.includes('위험 요소') || line.includes('위험요소')) && 
            nextLine && nextLine.length > 3 && 
            !nextLine.includes('중대성') && !nextLine.includes('가능성') && 
            !nextLine.includes('위험도')) {
          riskFactors.push(nextLine);
        }
      }
    }
    
    // 중복 제거 및 필터링
    const filteredFactors = [...new Set(riskFactors)].filter(f => f.length < 100);
    console.log(`위험 요소 ${filteredFactors.length}개 추출 완료`);
    return filteredFactors;
  } catch (error) {
    console.error('위험 요소 추출 오류:', error);
    return [];
  }
}

// 이미지 URL에서 Base64 데이터 가져오기
async function fetchImageAsBase64(imageUrl) {
  try {
    // 로컬 URL인 경우 (blob:, http:, https: 등으로 시작)
    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('http:') || imageUrl.startsWith('https:')) {
      console.log(`이미지 URL로부터 데이터 가져오는 중: ${imageUrl.substring(0, 30)}...`);
      
      // 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃
      
      try {
        const response = await fetch(imageUrl, { 
          signal: controller.signal,
          // CORS 오류 방지를 위해 credentials 포함
          credentials: 'include'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`이미지 가져오기 실패: HTTP 상태 ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        console.log(`이미지 데이터 가져오기 성공 (${base64.length} 바이트)`);
        return base64;
      } catch (fetchError) {
        console.error(`이미지 가져오기 오류: ${fetchError.message}`);
        
        // 타임아웃이나 네트워크 오류 발생 시 빈 응답 대신 null 반환
        return null;
      }
    }
    
    // data:image 형식인 경우 (이미 Base64)
    if (imageUrl.startsWith('data:image')) {
      console.log('Base64 형식의 이미지 데이터 확인됨');
      const base64Data = imageUrl.split(',')[1];
      return base64Data;
    }
    
    throw new Error('지원되지 않는 이미지 URL 형식');
  } catch (error) {
    console.error(`이미지 가져오기 오류: ${error.message}`);
    return null;
  }
}

// 이미지 MIME 타입 추출
function getImageMimeType(imageUrl) {
  if (imageUrl.startsWith('data:')) {
    const mimeMatch = imageUrl.match(/data:(image\/[^;]+);/);
    return mimeMatch ? mimeMatch[1] : 'image/jpeg';
  }
  
  // 확장자로 MIME 타입 추론
  const extensionMatch = imageUrl.match(/\.([^./?#]+)(?:[?#]|$)/);
  if (extensionMatch) {
    const ext = extensionMatch[1].toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }
  
  return 'image/jpeg';
}

export async function POST(request) {
  console.log('추가 위험성평가 API 호출 시작');
  
  try {
    // API 키 확인
    if (!API_KEY) {
      console.error('API 키가 설정되지 않음 - 환경 변수 누락');
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.' },
        { status: 500 }
      );
    }
    
    // 요청 데이터 파싱
    let reqData;
    try {
      reqData = await request.json();
      console.log('요청 데이터 파싱 성공');
    } catch (parseError) {
      console.error('요청 데이터 파싱 오류:', parseError);
      return NextResponse.json(
        { error: '요청 데이터를 파싱할 수 없습니다.' },
        { status: 400 }
      );
    }
    
    const { analysisItems } = reqData || {};
    
    if (!analysisItems) {
      console.error('분석 항목 데이터가 없습니다');
      return NextResponse.json(
        { error: '요청 데이터에 analysisItems가 없습니다.' },
        { status: 400 }
      );
    }
    
    console.log(`분석 항목 ${analysisItems.length}개 수신됨`);
    
    // 최신 이미지 찾기 (마지막으로 분석된 이미지)
    let latestImage = null;
    let latestImageUrl = null;
    let latestImageMimeType = null;
    
    for (let i = analysisItems.length - 1; i >= 0; i--) {
      const item = analysisItems[i];
      if (item.imageUrl) {
        latestImageUrl = item.imageUrl;
        latestImageMimeType = getImageMimeType(latestImageUrl);
        console.log(`최근 이미지 URL 찾음: ${latestImageUrl.substring(0, 30)}...`);
        break;
      }
    }
    
    // 이미지 데이터 가져오기
    if (latestImageUrl) {
      try {
        const base64Image = await fetchImageAsBase64(latestImageUrl);
        if (base64Image) {
          latestImage = base64Image;
          console.log(`이미지 데이터 가져오기 성공 (${base64Image.length} 바이트)`);
        } else {
          console.warn('이미지 데이터를 가져올 수 없습니다. 텍스트만으로 분석을 진행합니다.');
        }
      } catch (imgError) {
        console.error('이미지 데이터 가져오기 실패:', imgError);
      }
    } else {
      console.warn('이미지 URL이 없습니다. 텍스트만으로 분석을 진행합니다.');
    }
    
    // 기존 위험 요소 추출
    const existingFactors = extractRiskFactors(analysisItems);
    console.log(`기존 위험 요소 ${existingFactors.length}개 추출됨`);
    
    // 기존 위험 요소 목록화
    let factorsText = "없음";
    if (existingFactors.length > 0) {
      factorsText = existingFactors
        .slice(0, Math.min(existingFactors.length, 10))
        .map((f, i) => `${i+1}. ${f}`)
        .join('\n');
    }
    
    // 마지막 항목의 공정/장비 명칭 추출
    let processName = "";
    for (let i = analysisItems.length - 1; i >= 0; i--) {
      if (analysisItems[i].processName) {
        processName = analysisItems[i].processName;
        console.log(`공정/장비 명칭 찾음: ${processName}`);
        break;
      }
    }
    
    // 프롬프트 생성 (이미지 포함)
    const promptText = `당신은 산업 안전 전문가입니다. ${processName ? `분석 대상은 "${processName}"입니다.` : ""} 다음은 작업 현장의 이미지와 현재까지 다음 위험 요소들입니다:

현재까지 식별된 위험 요소:
${factorsText}

${latestImage ? "제공된 이미지를 분석하고, " : ""}위에 언급된 위험 요소들 외에 추가적인 위험 요소 3-5개를 식별해주세요.
기존에 언급된 위험 요소와 중복되지 않는 새로운 위험 요소에 초점을 맞추어 분석해주세요.

다음 사항을 필수적으로 지켜주세요:
1. 중대성(Severity)은 1~4 사이의 정수로 표시해야 합니다.
   - 4: 최대
   - 3: 대
   - 2: 중
   - 1: 소
2. 가능성(Probability)은 1~5 사이의 정수로 표시해야 합니다.
   - 5: 가능성 5(최고)
   - 4: 가능성 4
   - 3: 가능성 3
   - 2: 가능성 2
   - 1: 가능성 1(최저)
3. 위험도는 중대성과 가능성을 고려하여 다음과 같이 표시합니다:
   - 상(15~20점): 위험도 '상(점수)' 형식으로 표시 (예: 상(16))
   - 중(8~12점): 위험도 '중(점수)' 형식으로 표시 (예: 중(12))
   - 하(1~6점): 위험도 '하(점수)' 형식으로 표시 (예: 하(4))
4. 각 위험 요소는 구체적이고 명확하게 서술해주세요.
5. 반드시 위험도는 '등급(점수)' 형식으로 표시해주세요. 예: 중(12), 상(16), 하(4)

응답은 다음 HTML 테이블 형식으로 작성해주세요:

<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr style="background-color: #f3f4f6;">
      <th style="text-align: left; padding: 12px; border: 1px solid #E5E7EB;">위험 요소</th>
      <th style="text-align: left; padding: 12px; border: 1px solid #E5E7EB;">중대성(1-4)</th>
      <th style="text-align: left; padding: 12px; border: 1px solid #E5E7EB;">가능성(1-5)</th>
      <th style="text-align: left; padding: 12px; border: 1px solid #E5E7EB;">위험도</th>
      <th style="text-align: left; padding: 12px; border: 1px solid #E5E7EB;">위험감소대책</th>
    </tr>
  </thead>
  <tbody>
    <!-- 여기에 위험 요소 항목 작성 -->
  </tbody>
</table>`;
    
    console.log('Gemini API 호출 준비 완료');
    
    // Gemini API 호출
    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
      // 안전 타임아웃 설정
      console.log('API 요청 시작');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API 요청 시간 초과')), 45000)
      );
      
      // API 요청 콘텐츠 준비
      const contentParts = [{ text: promptText }];
      
      // 이미지가 있는 경우 추가
      if (latestImage && latestImageMimeType) {
        console.log(`이미지 데이터 포함하여 요청 (MIME 타입: ${latestImageMimeType})`);
        contentParts.push({
          inlineData: {
            mimeType: latestImageMimeType,
            data: latestImage
          }
        });
      } else {
        console.log('이미지 없이 텍스트만으로 요청');
      }
      
      // API 요청과 타임아웃 경쟁
      const responsePromise = model.generateContent(contentParts);
      const result = await Promise.race([responsePromise, timeoutPromise]);
      
      console.log('API 응답 수신, 텍스트 추출');
      const response = await result.response;
      const textResponse = response.text();
      
      if (!textResponse || textResponse.trim() === '') {
        throw new Error('API 응답이 비어있습니다');
      }
      
      console.log('Gemini API 응답 수신 완료 (길이: ' + textResponse.length + ')');
      
      // 추가 검증 - 유효한 HTML 테이블이 포함되어 있는지 확인
      if (!textResponse.includes('<table') || !textResponse.includes('</table>')) {
        console.warn('응답에 HTML 테이블이 포함되어 있지 않습니다. 간단한 테이블 구조로 포맷합니다.');
        // 기본 테이블 형식으로 응답 감싸기
        const wrappedResponse = `
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr style="background-color: #f3f4f6;">
      <th style="text-align: left; padding: 12px; border: 1px solid #E5E7EB;">위험 요소</th>
      <th style="text-align: left; padding: 12px; border: 1px solid #E5E7EB;">중대성(1-4)</th>
      <th style="text-align: left; padding: 12px; border: 1px solid #E5E7EB;">가능성(1-5)</th>
      <th style="text-align: left; padding: 12px; border: 1px solid #E5E7EB;">위험도</th>
      <th style="text-align: left; padding: 12px; border: 1px solid #E5E7EB;">위험감소대책</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td colspan="5">${textResponse}</td>
    </tr>
  </tbody>
</table>`;
        console.log('응답 재포맷 완료');
      }
      
      // 새 항목 생성
      const newId = Math.max(...analysisItems.map(item => item.id || 0), 0) + 1;
      
      // 마지막 항목의 processName 가져오기 (위에서 찾은 값 재사용)
      const newAnalysisItem = {
        id: newId,
        image: null,
        imageUrl: latestImageUrl, // 분석한 이미지 URL 유지
        analysis: textResponse.includes('<table') ? textResponse : wrappedResponse,
        loading: false,
        selectedRows: [],
        processName: processName // 공정/장비 명칭 포함
      };
      
      console.log('새 분석 항목 생성 완료, ID:', newId);
      return NextResponse.json({ additionalItems: [newAnalysisItem] });
    } catch (apiError) {
      console.error('Gemini API 호출 오류:', apiError);
      
      // 더 자세한 오류 정보 제공
      let errorMessage = `Gemini API 호출 중 오류: ${apiError.message || '알 수 없는 오류'}`;
      
      // API 키 관련 오류 확인
      if (apiError.message && (
        apiError.message.includes('key') || 
        apiError.message.includes('auth') || 
        apiError.message.includes('credential')
      )) {
        errorMessage = 'API 키가 유효하지 않거나 인증에 실패했습니다. API 키를 확인해주세요.';
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('전체 처리 오류:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message || '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
} 