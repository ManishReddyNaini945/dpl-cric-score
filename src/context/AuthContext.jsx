import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let didAnonymousSignIn = false;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setReady(true);
      } else if (!didAnonymousSignIn) {
        // Only attempt anon sign-in once
        didAnonymousSignIn = true;
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged will fire again with the anon user → sets ready
        } catch (err) {
          // Anonymous auth failed (e.g. disabled in Firebase Console)
          // Still mark ready so the app renders — Firestore public rules will allow reads
          console.warn('Anonymous auth failed:', err.code);
          setReady(true);
        }
      } else {
        // Signed out after anon was already attempted
        setUser(null);
        setReady(true);
      }
    });
    return unsub;
  }, []);

  const isAdmin = !!user && !user.isAnonymous;

  async function signOut() {
    await fbSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, ready, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
