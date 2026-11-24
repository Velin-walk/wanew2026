import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { isAdminEmail } from '../adminUtils';
import {
  isRestrictedAdminEmail,
  verifyRestrictedAdminDevice,
  bindRestrictedAdminDevice,
  unbindRestrictedAdminSlot,
  verifyAndBindDevFallbackDevice,
  clearRestrictedAdminVerificationState,
  initDeviceModelDetection,
  DeviceVerificationStatus,
  DeviceVerificationResult,
  AllowedDeviceSlot,
} from '../services/deviceLockService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  userEmail: string;
  userPhone: string;
  showProfileImage: boolean;
  setShowProfileImage: (show: boolean) => void;
  updateUserProfile: (data: { displayName?: string; showProfileImage?: boolean; phone?: string }) => Promise<void>;
  signInWithGoogle: () => Promise<User | null>;
  signInWithDevAccount: (email: string, displayName?: string, phone?: string) => Promise<User>;
  signOutUser: () => Promise<void>;
  authModalOpen: boolean;
  authModalReason: string;
  openAuthModal: (reason?: string, onSuccess?: () => void) => void;
  closeAuthModal: () => void;
  executePendingAction: () => void;
  deviceAuthStatus: DeviceVerificationStatus;
  deviceAuthInfo: DeviceVerificationResult | null;
  deviceAuthBusy: boolean;
  authorizeCurrentDeviceSlot: () => Promise<void>;
  unbindDeviceSlot: (slot: AllowedDeviceSlot) => Promise<void>;
  dismissDeviceAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userPhone, setUserPhone] = useState<string>(() => safeLocalStorage.getItem('wnw_user_phone') || '');
  const [loading, setLoading] = useState(true);
  const [showProfileImage, setShowProfileImageState] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [rolesRevision, setRolesRevision] = useState(0);
  const [deviceAuthStatus, setDeviceAuthStatus] = useState<DeviceVerificationStatus>('idle');
  const [deviceAuthInfo, setDeviceAuthInfo] = useState<DeviceVerificationResult | null>(null);
  const [deviceAuthBusy, setDeviceAuthBusy] = useState(false);

  useEffect(() => {
    const handleRolesUpdated = () => setRolesRevision((r) => r + 1);
    window.addEventListener('wnw-admin-roles-updated', handleRolesUpdated);
    return () => window.removeEventListener('wnw-admin-roles-updated', handleRolesUpdated);
  }, []);

  useEffect(() => {
    void initDeviceModelDetection();

    getRedirectResult(auth).catch((err) => {
      console.warn('Google Sign-In redirect notice:', err?.code || err?.message || err);
    });

    let activeCheckToken = 0;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const checkId = ++activeCheckToken;

      if (currentUser) {
        safeLocalStorage.removeItem('wnw_dev_user');

        if (isRestrictedAdminEmail(currentUser.email)) {
          setDeviceAuthStatus('checking');
          setUser(currentUser);

          try {
            const verification = await verifyRestrictedAdminDevice(
              currentUser.uid,
              currentUser.email || ''
            );
            if (checkId !== activeCheckToken) return;

            setDeviceAuthInfo(verification);
            if (verification.status === 'denied') {
              clearRestrictedAdminVerificationState();
              setDeviceAuthStatus('denied');
              setUser(null);
              setPendingAction(null);
              try {
                await firebaseSignOut(auth);
              } catch {}
            } else if (verification.status === 'needs_binding') {
              setDeviceAuthStatus('needs_binding');
            } else {
              setDeviceAuthStatus('authorized');
            }
          } catch (err) {
            if (checkId !== activeCheckToken) return;
            clearRestrictedAdminVerificationState();
            setDeviceAuthStatus('denied');
            setUser(null);
            try {
              await firebaseSignOut(auth);
            } catch {}
          } finally {
            if (checkId === activeCheckToken) {
              setLoading(false);
            }
          }
          return;
        }

        clearRestrictedAdminVerificationState();
        setDeviceAuthStatus('idle');
        setDeviceAuthInfo(null);
        setUser(currentUser);
        setLoading(false);
        return;
      }

      clearRestrictedAdminVerificationState();

      if (import.meta.env.DEV) {
        const savedDevUser = safeLocalStorage.getItem('wnw_dev_user');
        if (savedDevUser) {
          try {
            const parsed = JSON.parse(savedDevUser);
            if (parsed?.email) {
              if (isRestrictedAdminEmail(parsed.email)) {
                const check = await verifyAndBindDevFallbackDevice(parsed.email);
                if (checkId !== activeCheckToken) return;
                if (!check.allowed) {
                  safeLocalStorage.removeItem('wnw_dev_user');
                  setUser(null);
                  setDeviceAuthStatus('denied');
                  setLoading(false);
                  return;
                }
                setDeviceAuthStatus('authorized');
              }

              setUser({
                uid: parsed.uid || 'dev-user-saved',
                email: parsed.email,
                displayName: parsed.displayName || parsed.email.split('@')[0],
                photoURL: parsed.photoURL || '',
                emailVerified: true,
              } as unknown as User);
              if (parsed.phone) {
                setUserPhone(parsed.phone);
                safeLocalStorage.setItem('wnw_user_phone', parsed.phone);
              }
            }
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }

      if (checkId === activeCheckToken) {
        setLoading(false);
      }
    });

    return () => {
      activeCheckToken++;
      unsubscribe();
    };
  }, []);

  // Load saved phone number from registration profile if not set
  useEffect(() => {
    if (!userPhone) {
      try {
        const saved = safeLocalStorage.getItem('wnw_user_registration_profile') || safeLocalStorage.getItem('wnw_last_registration_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          const ph = parsed.phone || parsed.phoneNumber || parsed.phone_number || parsed.whatsapp;
          if (ph) {
            setUserPhone(ph);
            safeLocalStorage.setItem('wnw_user_phone', ph);
          }
        }
      } catch {}
    }
  }, [userPhone]);

  // Load showProfileImage preference when user changes
  useEffect(() => {
    if (user?.uid) {
      const saved = safeLocalStorage.getItem(`wnw_show_profile_img_${user.uid}`);
      if (saved !== null) {
        setShowProfileImageState(JSON.parse(saved));
      } else {
        setShowProfileImageState(true);
      }
    }
  }, [user?.uid]);

  const setShowProfileImage = (show: boolean) => {
    setShowProfileImageState(show);
    if (user?.uid) {
      safeLocalStorage.setItem(`wnw_show_profile_img_${user.uid}`, JSON.stringify(show));
    }
  };

  const updateUserProfile = async (data: { displayName?: string; showProfileImage?: boolean; phone?: string }) => {
    if (data.phone !== undefined) {
      const cleanPhone = data.phone.trim();
      setUserPhone(cleanPhone);
      safeLocalStorage.setItem('wnw_user_phone', cleanPhone);
      try {
        const p1 = safeLocalStorage.getItem('wnw_user_registration_profile');
        const existing = p1 ? JSON.parse(p1) : {};
        existing.phone = cleanPhone;
        safeLocalStorage.setItem('wnw_user_registration_profile', JSON.stringify(existing));
      } catch {}
    }

    if (!user) return;

    if (data.showProfileImage !== undefined) {
      setShowProfileImage(data.showProfileImage);
    }

    if (data.displayName !== undefined && data.displayName.trim() !== '') {
      const newName = data.displayName.trim();

      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: newName });
        } catch (e) {
          console.error('Failed to update Firebase user profile:', e);
        }
      }

      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          displayName: newName,
        } as User;
      });

      const savedDevUser = safeLocalStorage.getItem('wnw_dev_user');
      if (savedDevUser) {
        try {
          const parsed = JSON.parse(savedDevUser);
          parsed.displayName = newName;
          if (data.phone) parsed.phone = data.phone;
          safeLocalStorage.setItem('wnw_dev_user', JSON.stringify(parsed));
        } catch (e) {}
      }
    }
  };

  // Depend on rolesRevision + deviceAuthStatus so isAdmin updates immediately on verification
  const isAdmin = React.useMemo(() => {
    void rolesRevision;
    void deviceAuthStatus;
    return user?.email ? isAdminEmail(user.email) : false;
  }, [user?.email, rolesRevision, deviceAuthStatus]);

  const userEmail = user?.email || '';

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const signedInUser = result.user;

      if (isRestrictedAdminEmail(signedInUser.email)) {
        setDeviceAuthStatus('checking');
        const verification = await verifyRestrictedAdminDevice(
          signedInUser.uid,
          signedInUser.email || ''
        );
        setDeviceAuthInfo(verification);

        if (verification.status === 'denied') {
          clearRestrictedAdminVerificationState();
          setDeviceAuthStatus('denied');
          setUser(null);
          setPendingAction(null);
          setAuthModalOpen(false);
          try {
            await firebaseSignOut(auth);
          } catch {}
          return null;
        }

        if (verification.status === 'needs_binding') {
          setDeviceAuthStatus('needs_binding');
          setAuthModalOpen(false);
          return signedInUser;
        }

        setDeviceAuthStatus('authorized');
      }

      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
      setAuthModalOpen(false);
      return signedInUser;
    } catch (error: any) {
      const isInAppBrowser =
        typeof navigator !== 'undefined' &&
        /FBAN|FBAV|Instagram/i.test(navigator.userAgent || '');
      const shouldFallbackRedirect =
        error?.code === 'auth/popup-blocked' ||
        error?.code === 'auth/operation-not-supported-in-this-environment' ||
        (isInAppBrowser && error?.code !== 'auth/popup-closed-by-user');

      if (shouldFallbackRedirect) {
        await signInWithRedirect(auth, googleProvider);
        return null;
      }

      console.warn('Google Sign-In notice:', error?.code || error?.message || error);
      throw error;
    }
  };

  const signInWithDevAccount = async (email: string, displayName?: string, phone?: string) => {
    const cleanEmail = email.trim().toLowerCase();

    if (isRestrictedAdminEmail(cleanEmail)) {
      const check = await verifyAndBindDevFallbackDevice(cleanEmail);
      if (!check.allowed) {
        setDeviceAuthStatus('denied');
        throw new Error(check.reason || 'This device is not authorized for walknepalwalk@gmail.com.');
      }
      setDeviceAuthStatus('authorized');
    }

    const mockUser = {
      uid: 'dev-user-' + Date.now(),
      email: cleanEmail,
      displayName: displayName || cleanEmail.split('@')[0],
      photoURL: '',
      emailVerified: true,
    } as unknown as User;

    setUser(mockUser);
    if (phone) {
      setUserPhone(phone);
      safeLocalStorage.setItem('wnw_user_phone', phone);
    }
    safeLocalStorage.setItem(
      'wnw_dev_user',
      JSON.stringify({
        uid: mockUser.uid,
        email: mockUser.email,
        displayName: mockUser.displayName,
        phone: phone || userPhone || '',
      })
    );

    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    setAuthModalOpen(false);
    return mockUser;
  };

  const signOutUser = async () => {
    safeLocalStorage.removeItem('wnw_dev_user');
    clearRestrictedAdminVerificationState();
    setDeviceAuthStatus('idle');
    setDeviceAuthInfo(null);
    setUser(null);
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign-Out error:', error);
    }
  };

  const authorizeCurrentDeviceSlot = async () => {
    if (!user || !isRestrictedAdminEmail(user.email)) return;
    setDeviceAuthBusy(true);
    try {
      const res = await bindRestrictedAdminDevice(user.uid, user.email || '');
      setDeviceAuthInfo(res);
      if (res.status === 'authorized') {
        setDeviceAuthStatus('authorized');
        if (pendingAction) {
          pendingAction();
          setPendingAction(null);
        }
      } else {
        clearRestrictedAdminVerificationState();
        setDeviceAuthStatus('denied');
        setUser(null);
        setPendingAction(null);
        try {
          await firebaseSignOut(auth);
        } catch {}
      }
    } finally {
      setDeviceAuthBusy(false);
    }
  };

  const unbindDeviceSlot = async (slot: AllowedDeviceSlot) => {
    if (!user || !isRestrictedAdminEmail(user.email)) return;
    setDeviceAuthBusy(true);
    try {
      const updatedSlots = await unbindRestrictedAdminSlot(user.uid, user.email || '', slot);
      setDeviceAuthInfo((prev) =>
        prev
          ? {
              ...prev,
              slots: updatedSlots,
            }
          : prev
      );
      if (deviceAuthInfo?.slot === slot) {
        setDeviceAuthStatus('needs_binding');
      }
    } finally {
      setDeviceAuthBusy(false);
    }
  };

  const dismissDeviceAuthError = () => {
    if (deviceAuthStatus === 'denied') {
      setDeviceAuthStatus('idle');
      setDeviceAuthInfo(null);
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
        userPhone,
        showProfileImage,
        setShowProfileImage,
        updateUserProfile,
        signInWithGoogle,
        signInWithDevAccount,
        signOutUser,
        authModalOpen,
        authModalReason,
        openAuthModal,
        closeAuthModal,
        executePendingAction,
        deviceAuthStatus,
        deviceAuthInfo,
        deviceAuthBusy,
        authorizeCurrentDeviceSlot,
        unbindDeviceSlot,
        dismissDeviceAuthError,
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
