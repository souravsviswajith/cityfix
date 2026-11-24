import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleAuthProvider } from '../lib/firebase';
import {
  OperationType,
  handleFirestoreError,
  testConnection,
} from '../lib/firestoreError';
import type { CitizenSession } from '../types/civic';

export interface CitizenBookmarkItem {
  id: string;
  userId: string;
  reportId: string;
  wardId: string;
  note: string;
  createdAt?: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  session: CitizenSession | null;
  authReady: boolean;
  firestoreOnline: boolean;
  workspaceAccessToken: string | null;
  bookmarks: CitizenBookmarkItem[];
  signInWithGoogle: () => Promise<CitizenSession | null>;
  connectWorkspace: () => Promise<string | null>;
  clearWorkspaceToken: () => void;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  saveBookmark: (reportId: string, wardId: string, note: string) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// In-memory cache only for Workspace OAuth access token (never localStorage/sessionStorage)
let cachedWorkspaceToken: string | null = null;
let isSigningIn = false;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<CitizenSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firestoreOnline, setFirestoreOnline] = useState(true);
  const [workspaceAccessToken, setWorkspaceAccessToken] = useState<string | null>(
    () => cachedWorkspaceToken
  );
  const [bookmarks, setBookmarks] = useState<CitizenBookmarkItem[]>([]);

  useEffect(() => {
    testConnection().then((ok) => setFirestoreOnline(ok));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        cachedWorkspaceToken = null;
        setWorkspaceAccessToken(null);
        setSession(null);
        setBookmarks([]);
        setAuthReady(true);
        return;
      }

      if (!isSigningIn && cachedWorkspaceToken) {
        setWorkspaceAccessToken(cachedWorkspaceToken);
      }

      try {
        const idToken = await user.getIdToken();
        let dbRole: 'citizen' | 'responder' | 'coordinator' = 'citizen';

        // Sync Firebase user into Cloud SQL users table
        const syncRes = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ displayName: user.displayName ?? 'Verified Citizen' }),
        });
        if (syncRes.ok) {
          const data = await syncRes.json();
          if (
            data.user?.role === 'coordinator' ||
            data.user?.role === 'responder' ||
            data.user?.role === 'citizen'
          ) {
            dbRole = data.user.role;
          }
        }

        // Sync non-PII profile doc in Firestore users/{uid}
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(
            userDocRef,
            {
              uid: user.uid,
              displayName: (user.displayName ?? 'Verified Citizen').slice(0, 100),
              meshCallsign: `NODE-${user.uid.slice(0, 6).toUpperCase()}`,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (err) {
          console.warn('Firestore user profile sync skipped or denied:', err);
        }

        setSession({
          authenticated: true,
          uid: user.uid,
          email: user.email ?? '',
          role: dbRole,
          idToken,
          name: user.displayName || user.email?.split('@')[0] || 'Verified Citizen',
          contact: user.email || user.uid,
          channel: 'Google Sign-In',
          verifiedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Auth sync error:', err);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Authenticated real-time Firestore listener for citizen_bookmarks
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setBookmarks([]);
      return;
    }

    const q = query(
      collection(db, 'citizen_bookmarks'),
      where('userId', '==', firebaseUser.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: CitizenBookmarkItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId ?? ''),
            reportId: String(data.reportId ?? ''),
            wardId: String(data.wardId ?? ''),
            note: String(data.note ?? ''),
          };
        });
        setBookmarks(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'citizen_bookmarks');
      }
    );

    return () => unsub();
  }, [authReady, firebaseUser]);

  const signInWithGoogle = async (): Promise<CitizenSession | null> => {
    isSigningIn = true;
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedWorkspaceToken = credential.accessToken;
        setWorkspaceAccessToken(credential.accessToken);
      }
      const idToken = await result.user.getIdToken();
      const nextSession: CitizenSession = {
        authenticated: true,
        uid: result.user.uid,
        email: result.user.email ?? '',
        role: 'citizen',
        idToken,
        name: result.user.displayName || result.user.email?.split('@')[0] || 'Verified Citizen',
        contact: result.user.email || result.user.uid,
        channel: 'Google Sign-In',
        verifiedAt: new Date().toISOString(),
      };
      setSession(nextSession);
      return nextSession;
    } finally {
      isSigningIn = false;
    }
  };

  const connectWorkspace = async (): Promise<string | null> => {
    isSigningIn = true;
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken ?? null;
      cachedWorkspaceToken = token;
      setWorkspaceAccessToken(token);
      return token;
    } finally {
      isSigningIn = false;
    }
  };

  const clearWorkspaceToken = () => {
    cachedWorkspaceToken = null;
    setWorkspaceAccessToken(null);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    cachedWorkspaceToken = null;
    setWorkspaceAccessToken(null);
    setSession(null);
    setBookmarks([]);
  };

  const refreshToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    const tok = await auth.currentUser.getIdToken();
    setSession((prev) => (prev ? { ...prev, idToken: tok } : prev));
    return tok;
  };

  const saveBookmark = async (reportId: string, wardId: string, note: string) => {
    if (!auth.currentUser) {
      throw new Error('Sign in with Google to bookmark reports.');
    }
    const safeId = `bm_${auth.currentUser.uid.slice(0, 12)}_${reportId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const docRef = doc(db, 'citizen_bookmarks', safeId);
    try {
      await setDoc(docRef, {
        userId: auth.currentUser.uid,
        reportId: reportId.slice(0, 64),
        wardId: wardId.slice(0, 64),
        note: note.slice(0, 500),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `citizen_bookmarks/${safeId}`);
    }
  };

  const removeBookmark = async (bookmarkId: string) => {
    try {
      await deleteDoc(doc(db, 'citizen_bookmarks', bookmarkId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `citizen_bookmarks/${bookmarkId}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        session,
        authReady,
        firestoreOnline,
        workspaceAccessToken,
        bookmarks,
        signInWithGoogle,
        connectWorkspace,
        clearWorkspaceToken,
        signOut,
        refreshToken,
        saveBookmark,
        removeBookmark,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
