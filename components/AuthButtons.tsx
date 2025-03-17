'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '../app/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { signOut } from '../app/lib/auth';

const AuthButtons = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  if (loading) {
    return null;
  }

  if (user) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm md:text-base text-white">
          {user.email}
        </span>
        <Link
          href="/profile"
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          프로필
        </Link>
        <button
          onClick={handleSignOut}
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="flex space-x-2">
      <Link 
        href="/auth"
        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors"
      >
        로그인
      </Link>
      <Link 
        href="/auth?mode=register"
        className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
      >
        회원가입
      </Link>
    </div>
  );
};

export default AuthButtons; 