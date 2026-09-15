import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { isAdminEmail } from '../adminUtils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  userEmail: string;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  authModalOpen: boolean;
  authModalReason: string;
  openAuthModal: (reason?: string, onSuccess?: () => void) => void;
  closeAuthModal: () => void;
  executePendingAction: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = user?.email ? isAdminEmail(user.email) : false;
  const userEmail = user?.email || '';

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
      setAuthModalOpen(false);
      return result.user;
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign-Out error:', error);
    }
  };

  const openAuthModal = (reason: string = '', onSuccess?: () => void) => {
    setAuthModalReason(reason);
    if (onSuccess) {
      setPendingAction(() => onSuccess);
    } else {
      setPendingAction(null);
    }
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setPendingAction(null);
  };

  const executePendingAction = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        userEmail,
        signInWithGoogle,
        signOutUser,
        authModalOpen,
        authModalReason,
        openAuthModal,
        closeAuthModal,
        executePendingAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
