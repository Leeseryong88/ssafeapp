'use client';

import { ReactNode, useEffect, createContext, useContext, useState } from 'react';
import { initializeAnalytics } from '../app/lib/firebase';
import { auth } from '../app/lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';

interface FirebaseProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<{ user: User | null; loading: boolean }>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

const FirebaseProvider = ({ children }: FirebaseProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize Firebase Analytics on the client-side
    const setupAnalytics = async () => {
      try {
        const analytics = await initializeAnalytics();
        console.log('Firebase Analytics initialized:', !!analytics);
      } catch (error) {
        console.error('Error initializing Firebase Analytics:', error);
      }
    };

    setupAnalytics();

    // 인증 상태 감시
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default FirebaseProvider; 