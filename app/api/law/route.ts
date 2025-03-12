import { NextRequest, NextResponse } from 'next/server';

// 환경 변수에서 API 키(OC) 가져오기
const OC = process.env.LAW_API_OC || 'test'; // 실제 발급받은 OC로 변경 필요

export async function GET(request: NextRequest) {
  const searchText = request.nextUrl.searchParams.get('text');
  
  if (!searchText) {
    return NextResponse.json({ error: '검색할 법령 정보가 필요합니다.' }, { status: 400 });
  }

  try {
    // 1. 법령명 추출
    const lawNameMatch = searchText.match(/^(.+?(?:법|규칙|규정|고시|지침))/);
    const lawName = lawNameMatch ? lawNameMatch[1].trim() : searchText.trim();
    
    // 2. 조항 추출 (예: 제30조, 제10조제1항)
    const articleMatch = searchText.match(/제(\d+)조(?:제(\d+)항)?/);
    let joParam = '';
    
    if (articleMatch) {
      const article = articleMatch[1].padStart(4, '0');
      const subArticle = articleMatch[2] ? articleMatch[2].padStart(2, '0') : '00';
      joParam = `&JO=${article}${subArticle}`;
    }
    
    // 3. API 호출 URL 구성
    const apiUrl = `http://www.law.go.kr/DRF/lawService.do?OC=${OC}&target=law&type=JSON&LM=${encodeURIComponent(lawName)}${joParam}`;
    
    const response = await fetch(apiUrl);
    const rawData = await response.text();
    
    // 4. 응답 처리
    // API가 잘못된 JSON을 반환하는 경우가 있어 예외 처리
    let data;
    try {
      data = JSON.parse(rawData);
    } catch (e) {
      // HTML이나 오류 응답일 수 있음
      // 기본 웹페이지 URL 반환
      return NextResponse.json({
        success: false,
        url: `https://www.law.go.kr/lsSc.do?section=&menuId=1&subMenuId=15&tabMenuId=81&eventGubun=060101&query=${encodeURIComponent(lawName)}`
      });
    }
    
    // 5. 응답 데이터에서 필요한 정보 추출
    if (data && data.law) {
      const lawInfo = data.law[0]; // 첫 번째 결과 사용
      const mst = lawInfo.MST || lawInfo.lsiSeq;
      
      // 6. 웹페이지 URL 구성
      let webUrl = `https://www.law.go.kr/lsInfoP.do?lsiSeq=${mst}`;
      if (articleMatch) {
        webUrl += `#JO_${articleMatch[1]}`;
        if (articleMatch[2]) {
          webUrl += `PARAGRAPH_${articleMatch[2]}`;
        }
      }
      
      return NextResponse.json({
        success: true,
        lawName: lawInfo.법령명_한글 || lawName,
        mst: mst,
        url: webUrl
      });
    } else {
      // 결과가 없는 경우 검색 페이지 URL 반환
      return NextResponse.json({
        success: false,
        url: `https://www.law.go.kr/lsSc.do?section=&menuId=1&subMenuId=15&tabMenuId=81&eventGubun=060101&query=${encodeURIComponent(lawName)}`
      });
    }
    
  } catch (error) {
    console.error('법령정보 API 호출 중 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: '법령정보를 가져오는 중 오류가 발생했습니다.',
      url: `https://www.law.go.kr`
    }, { status: 500 });
  }
} 