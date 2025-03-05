# 이미지 분석 애플리케이션

Google Gemini API를 활용하여 이미지를 분석하는 Next.js 웹 애플리케이션입니다.

## 기능

- 이미지 업로드 (드래그 앤 드롭 또는 파일 선택)
- Google Gemini API를 사용한 이미지 분석
- 분석 결과 표시

## 시작하기

### 사전 요구사항

- Node.js 18.0.0 이상
- Google Gemini API 키 ([Google AI Studio](https://ai.google.dev/)에서 발급 가능)

### 설치

1. 저장소 클론

```bash
git clone https://github.com/yourusername/image-analysis-app.git
cd image-analysis-app
```

2. 의존성 설치

```bash
npm install
# 또는
yarn install
```

3. 환경 변수 설정

`.env.local.example` 파일을 `.env.local`로 복사하고 Gemini API 키를 입력합니다.

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 열고 `GEMINI_API_KEY` 값을 설정합니다.

4. 개발 서버 실행

```bash
npm run dev
# 또는
yarn dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 애플리케이션을 확인할 수 있습니다.

## 기술 스택

- [Next.js](https://nextjs.org/) - React 프레임워크
- [TypeScript](https://www.typescriptlang.org/) - 정적 타입 지원
- [Tailwind CSS](https://tailwindcss.com/) - 스타일링
- [Google Generative AI SDK](https://ai.google.dev/) - Gemini API 연동

## 라이선스

MIT 