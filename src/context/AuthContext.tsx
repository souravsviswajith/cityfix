import React, { createContext, useContext, useEffect, useState } from 'react';
import {
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
  bookmarks: CitizenBookmarkItem[];
  signInWithGoogle: () => Promise<CitizenSession | null>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  saveBookmark: (reportId: string, wardId: string, note: string) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<CitizenSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firestoreOnline, setFirestoreOnline] = useState(true);
  const [bookmarks, setBookmarks] = useState<CitizenBookmarkItem[]>([]);

  useEffect(() => {
    testConnection().then((ok) => setFirestoreOnline(ok));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setSession(null);
        setBookmarks([]);
        setAuthReady(true);
        return;
      }

      try {
        const idToken = await user.getIdToken();
        let dbRole: 'citizen' | 'responder' | 'coordinator' =
          user.email?.toLowerCase() === 'souravsviswajith@gmail.com'
            ? 'coordinator'
            : 'citizen';

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
    const result = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await result.user.getIdToken();
    const nextSession: CitizenSession = {
      authenticated: true,
      uid: result.user.uid,
      email: result.user.email ?? '',
      role:
        result.user.email?.toLowerCase() === 'souravsviswajith@gmail.com'
          ? 'coordinator'
          : 'citizen',
      idToken,
      name: result.user.displayName || result.user.email?.split('@')[0] || 'Verified Citizen',
      contact: result.user.email || result.user.uid,
      channel: 'Google Sign-In',
      verifiedAt: new Date().toISOString(),
    };
    setSession(nextSession);
    return nextSession;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
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
        bookmarks,
        signInWithGoogle,
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
