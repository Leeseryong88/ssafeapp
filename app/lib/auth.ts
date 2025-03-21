'use client';

import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  sendPasswordResetEmail,
  OAuthProvider,
} from 'firebase/auth';
import { auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// 이메일/비밀번호로 회원가입
export const registerWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(getAuthErrorMessage(error.code));
  }
};

// 이메일/비밀번호로 로그인
export const loginWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(getAuthErrorMessage(error.code));
  }
};

// 구글 로그인
export const loginWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(getAuthErrorMessage(error.code));
  }
};

// 카카오 로그인
export const loginWithKakao = async () => {
  try {
    const provider = new OAuthProvider('oidc.kakao');
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    // Kakao OIDC로 로그인
    const userCredential = await signInWithPopup(auth, provider);
    const kakaoUser = userCredential.user;
    
    if (!kakaoUser) {
      throw new Error('카카오 로그인에 실패했습니다.');
    }

    console.log('Kakao user photo URL:', kakaoUser.photoURL);
    console.log('Kakao user provider data:', kakaoUser.providerData);

    // Firestore에 사용자 정보 저장
    const userDocRef = doc(db, 'users', kakaoUser.uid);
    
    // Firestore에 사용자 문서가 있는지 확인
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      // 새 사용자인 경우 문서 생성
      const userData = {
        email: kakaoUser.email || '',
        displayName: kakaoUser.displayName || '',
        createdAt: new Date(),
        phoneNumber: '',
        company: '',
        position: '',
        bio: '',
        profileImage: kakaoUser.photoURL || '',
        provider: 'kakao',
        providerPhotoURL: kakaoUser.photoURL || ''
      };
      console.log('New user data:', userData);
      await setDoc(userDocRef, userData);
    } else {
      // 기존 사용자인 경우 정보 업데이트
      const updateData = {
        displayName: kakaoUser.displayName || '',
        email: kakaoUser.email || '',
        profileImage: kakaoUser.photoURL || userDoc.data().profileImage || '',
        providerPhotoURL: kakaoUser.photoURL || '',
        provider: 'kakao',
        lastLoginAt: new Date()
      };
      console.log('Update user data:', updateData);
      await updateDoc(userDocRef, updateData);
    }

    return kakaoUser;
  } catch (error: any) {
    console.error('Kakao login error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

// 로그아웃
export const signOut = async () => {
  try {
    // Firebase 로그아웃
    await firebaseSignOut(auth);
    
    // 로컬 스토리지 초기화
    localStorage.clear();
    
    // 세션 스토리지 초기화
    sessionStorage.clear();
    
    // 쿠키 초기화 (필요한 경우)
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // 랜딩 페이지로 이동
    window.location.href = '/';
    
    return true;
  } catch (error) {
    console.error('로그아웃 오류:', error);
    return false;
  }
};

// 비밀번호 재설정 이메일 발송
export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error: any) {
    throw new Error(getAuthErrorMessage(error.code));
  }
};

// 현재 사용자 가져오기
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// 인증 상태 변경 감지 (Hook에서 사용)
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// 에러 메시지 변환
const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다.';
    case 'auth/invalid-email':
      return '유효하지 않은 이메일 형식입니다.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.';
    case 'auth/user-not-found':
      return '등록되지 않은 이메일입니다.';
    case 'auth/wrong-password':
      return '잘못된 비밀번호입니다.';
    case 'auth/too-many-requests':
      return '너무 많은 로그인 시도로 인해 계정이 일시적으로 잠겼습니다. 나중에 다시 시도해주세요.';
    case 'auth/popup-closed-by-user':
      return '로그인 창이 닫혔습니다. 다시 시도해주세요.';
    default:
      return '인증 오류가 발생했습니다. 다시 시도해주세요.';
  }
}; 