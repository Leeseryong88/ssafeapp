import { GoogleGenerativeAI } from '@google/generative-ai';

interface Analysis {
  risk_factors: string[];
  improvements: string[];
  regulations: string[];
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// Gemini 2.0 Flash 모델 사용
export const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// 이미지 분석을 위한 vision 모델
export const geminiVisionModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export const analyzeImage = async (imageParts: any): Promise<Analysis> => {
  try {
    const result = await geminiModel.generateContent([
      "당신은 산업 안전 전문가입니다. 이 이미지에서 발견되는 산업 안전 위험 요소들을 분석하고, 다음 형식으로 답변해주세요:\n\n" +
      "1. 위험 요인: (발견된 위험 요소들을 나열)\n" +
      "2. 개선 방안: (각 위험 요소에 대한 구체적인 개선 방안 제시)\n" +
      "3. 관계 법령: (위험 요소와 관련된 산업안전보건법 조항 명시)",
      imageParts,
    ]);

    const response = result.response;
    const text = response.text();
    
    // 응답 텍스트를 파싱하여 구조화된 데이터로 변환
    const sections = text.split('\n\n');
    const analysis: Analysis = {
      risk_factors: [],
      improvements: [],
      regulations: []
    };

    sections.forEach(section => {
      if (section.startsWith('1. 위험 요인:')) {
        analysis.risk_factors = section
          .replace('1. 위험 요인:', '')
          .split('\n')
          .filter(item => item.trim())
          .map(item => item.trim().replace(/^[-•*]\s*/, ''));
      } else if (section.startsWith('2. 개선 방안:')) {
        analysis.improvements = section
          .replace('2. 개선 방안:', '')
          .split('\n')
          .filter(item => item.trim())
          .map(item => item.trim().replace(/^[-•*]\s*/, ''));
      } else if (section.startsWith('3. 관계 법령:')) {
        analysis.regulations = section
          .replace('3. 관계 법령:', '')
          .split('\n')
          .filter(item => item.trim())
          .map(item => item.trim().replace(/^[-•*]\s*/, ''));
      }
    });

    return analysis;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}; 