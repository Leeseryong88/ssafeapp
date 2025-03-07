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

    // Firestore에 사용자 정보 저장
    const userDocRef = doc(db, 'users', kakaoUser.uid);
    
    // Firestore에 사용자 문서가 있는지 확인
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      // 새 사용자인 경우 문서 생성
      await setDoc(userDocRef, {
        email: kakaoUser.email || '',
        displayName: kakaoUser.displayName || '',
        createdAt: new Date(),
        phoneNumber: '',
        company: '',
        position: '',
        bio: '',
        profileImage: kakaoUser.photoURL || null,
        provider: 'kakao'
      });
    } else {
      // 기존 사용자인 경우 정보 업데이트
      await updateDoc(userDocRef, {
        displayName: kakaoUser.displayName || '',
        email: kakaoUser.email || '',
        profileImage: kakaoUser.photoURL || null,
        provider: 'kakao'
      });
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
    await firebaseSignOut(auth);
    return true;
  } catch (error) {
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