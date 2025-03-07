# 이미지 분석 애플리케이션

Google Gemini API를 활용하여 이미지를 분석하는 Next.js 웹 애플리케이션입니다.

## 기능

- 이미지 업로드 (드래그 앤 드롭 또는 파일 선택)
- Google Gemini API를 사용한 이미지 분석
- 분석 결과 표시
- Firebase 인증 및 데이터 저장

## 시작하기

### 사전 요구사항

- Node.js 18.0.0 이상
- Google Gemini API 키 ([Google AI Studio](https://ai.google.dev/)에서 발급 가능)
- Firebase 프로젝트 및 설정

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

`.env.local.example` 파일을 `.env.local`로 복사하고 필요한 API 키와 설정값을 입력합니다.

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 열고 다음 값들을 설정합니다:

```
# Google Gemini API 키
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here

# Firebase 설정
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

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
- [Firebase](https://firebase.google.com/) - 인증 및 데이터 저장

## GitHub 업로드 시 주의사항

저장소를 GitHub에 업로드하기 전에 다음 사항을 확인하세요:

1. **민감한 API 키 보호**
   - `.env.local` 파일에 있는 API 키가 포함되지 않도록 합니다.
   - 실제 API 키를 공개 저장소에 절대 업로드하지 마세요.
   - 커밋하기 전에 `git add .env.local` 명령이 없는지 확인하세요.
   - Firebase 설정 정보도 환경 변수를 통해 관리하고 하드코딩하지 마세요.

2. **대용량 파일 제외**
   - `node_modules` 폴더와 `.next` 빌드 디렉토리는 `.gitignore`에 포함되어 있는지 확인하세요.

3. **개인 정보 확인**
   - 코드 내 하드코딩된 사용자 이름이나 이메일 주소 등의 개인 정보가 없는지 확인하세요.

4. **커밋 전 보안 검사**
   - 제공된 `pre-commit-check.js` 스크립트를 실행하여 민감한 정보 검사:
   ```bash
   node pre-commit-check.js
   ```
   - 이 스크립트는 코드에서 API 키, 비밀번호 등의 민감한 정보를 찾아냅니다.

5. **업로드 전 확인 명령어**
   ```bash
   git status
   ```
   위 명령어로 업로드될 파일 목록을 확인하고, 민감한 정보가 포함된 파일이 없는지 검토하세요.

6. **환경 변수 관리**
   ```bash
   git update-index --assume-unchanged .env.local
   ```
   위 명령어를 사용하면 로컬에서 .env.local 파일을 변경해도 깃에서 추적하지 않습니다.

## 라이선스

MIT 