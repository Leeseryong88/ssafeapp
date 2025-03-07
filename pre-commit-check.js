const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 검사할 파일 패턴
const sensitiveFilePatterns = [
  '.env.local',
  '.env.development',
  '.env.production',
];

// 검사할 키워드
const sensitiveKeywords = [
  'apiKey',
  'API_KEY',
  'api_key',
  'password',
  'secret',
  'token',
  'credential',
  'private',
];

// 민감한 정보가 포함된 파일 패턴 확인
console.log('민감한 정보가 포함될 수 있는 파일 확인 중...');
const sensitiveFiles = sensitiveFilePatterns.filter(pattern => {
  return fs.existsSync(path.join(process.cwd(), pattern));
});

if (sensitiveFiles.length > 0) {
  console.log('\n⚠️ 주의: 다음 파일들이 저장소에 포함되어 있습니다:');
  sensitiveFiles.forEach(file => {
    console.log(`  - ${file}`);
  });
  console.log('\n이 파일들은 민감한 정보를 포함할 수 있으므로 .gitignore에 추가하거나 삭제해야 합니다.');
}

// 코드에서 민감한 키워드 검색
console.log('\n코드 내 민감한 정보 검색 중...');

// git add된 파일 목록 가져오기
exec('git diff --cached --name-only', (error, stdout) => {
  if (error) {
    console.error(`Error getting git staged files: ${error}`);
    return;
  }

  const stagedFiles = stdout.trim().split('\n').filter(Boolean);
  if (stagedFiles.length === 0) {
    console.log('스테이지된 파일이 없습니다.');
    return;
  }

  // .env 파일이나 바이너리 파일 제외
  const filesToCheck = stagedFiles.filter(file => {
    if (!fs.existsSync(file)) return false;
    if (file.includes('.env')) return false;
    if (path.extname(file) === '') return false;
    
    // 텍스트 파일인지 확인
    try {
      const buffer = fs.readFileSync(file);
      const isText = !buffer.includes(0);
      return isText;
    } catch (e) {
      return false;
    }
  });

  let foundSensitiveInfo = false;

  filesToCheck.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, i) => {
      sensitiveKeywords.forEach(keyword => {
        if (line.includes(keyword) && 
            !line.startsWith('//') && 
            !line.startsWith('#') && 
            !line.includes('process.env')) {
          console.log(`\n⚠️ 파일 ${file}의 ${i+1}번째 줄에서 민감한 정보가 발견되었을 수 있습니다:`);
          console.log(`  ${line.trim()}`);
          foundSensitiveInfo = true;
        }
      });
    });
  });

  if (!foundSensitiveInfo) {
    console.log('검사한 파일에서 민감한 정보가 발견되지 않았습니다.');
  } else {
    console.log('\n발견된 민감한 정보는 환경 변수로 이동하거나 제거해야 합니다.');
    console.log('예시: const apiKey = process.env.API_KEY');
  }
});

console.log('\n확인 작업을 마쳤습니다. 문제가 발견되면 수정 후 다시 커밋하세요.');
console.log('환경 변수 파일을 깃 추적에서 제외하려면 다음 명령어를 실행하세요:');
console.log('git update-index --assume-unchanged .env.local'); 