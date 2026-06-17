import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
      } else {
        // Auto sign-in as anonymous user
        await signInAnonymously(auth).catch(console.error);
      }
      setReady(true);
    });
    return unsub;
  }, []);

  // Admin = signed in with email/password (not anonymous)
  const isAdmin = !!user && !user.isAnonymous;

  async function signOut() {
    await fbSignOut(auth);
    // Will re-trigger onAuthStateChanged → signs in anonymously again
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
