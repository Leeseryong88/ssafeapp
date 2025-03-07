'use client';

import { ReactNode, useEffect } from 'react';
import { initializeAnalytics } from '../app/lib/firebase';

interface FirebaseProviderProps {
  children: ReactNode;
}

const FirebaseProvider = ({ children }: FirebaseProviderProps) => {
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
  }, []);

  return <>{children}</>;
};

export default FirebaseProvider; 