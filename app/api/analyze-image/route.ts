import { NextResponse } from 'next/server';
import { analyzeImage } from '@/app/lib/gemini';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json(
        { error: '이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    // 이미지를 base64로 변환
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');

    // Gemini API에 전달할 이미지 데이터 준비
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: image.type
      }
    };

    // Gemini API를 사용하여 이미지 분석
    const analysis = await analyzeImage(imagePart);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 